import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useRef } from 'react';
import { Group, MathUtils, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type Object3D } from 'three';

import { useTrackerStore } from '@/lib/state/tracker-store';
import { dampingBlend } from '@/lib/time/damping';

import { LowPolyIss } from './fallbacks/LowPolyIss';
import { GltfIss } from './GltfIss';
import { useIssFrame } from './iss-frame';
import { applyShade, collectShadeSlots, emissiveMaterials, nextShade, type ShadeSlot } from './iss-materials';
import { IssLabel } from './IssLabel';
import { ModelErrorBoundary } from './ModelErrorBoundary';
import { ISS_SCENE_SCALE } from './scene-constants';

/** Per-second exponential rates: higher settles faster. */
const ORIENT_RATE = 8;
const WING_RATE = 2.5;
const HOVER_RATE = 12;
/** A larger jump than this (radians) is a scrub or a view change, so snap instead of easing. */
const SNAP_ANGLE = 0.6;
const HOVER_SCALE = 1.15;
const POP_IN_SECONDS = 0.7;
/** Sun this close to the truss axis has no meaningful panel angle, so the wings hold still. */
const MIN_SUN_PLANAR = 0.05;
const BEACON_PERIOD_SECONDS = 1.4;
const BEACON_FLASH_FRACTION = 0.22;
const NIGHT_LAMP_BOOST = 1.4;
/** Hit sphere in scene units: the 0.16 wide model is hard to click otherwise. */
const HIT_RADIUS = 0.11;

const WING_NAME = /^SolarWing_[A-Za-z0-9]+$/;

interface Wing {
  node: Object3D;
  baseX: number;
}

interface BeaconLamp {
  material: MeshStandardMaterial;
  baseIntensity: number;
}

interface Rigging {
  source: Object3D | null;
  wings: Wing[];
  lamps: BeaconLamp[];
  /** Every other material, dimmed while the station is in Earth's shadow. */
  shades: ShadeSlot[];
}

interface RigState {
  rigging: Rigging;
  oriented: boolean;
  wingAngle: number;
  hasWingAngle: boolean;
  /** 0 in sunlight, 1 deep in Earth's shadow; eased so entering and leaving the shadow is soft. */
  shade: number;
  appear: number;
  hover: number;
  hovered: boolean;
}

const radialAxis = new Vector3();
const forwardAxis = new Vector3();
const sideAxis = new Vector3();
const sunLocal = new Vector3();
const basis = new Matrix4();
const targetQuat = new Quaternion();
const inverseQuat = new Quaternion();

function easeOutBack(t: number): number {
  const overshoot = 1.70158;
  const shifted = t - 1;
  return 1 + (overshoot + 1) * shifted ** 3 + overshoot * shifted ** 2;
}

/** The glTF exporter names a node and its first primitive mesh alike, so skip the inner twin. */
function isWingRoot(node: Object3D): boolean {
  return WING_NAME.test(node.name) && node.parent?.name !== node.name;
}

function scanRigging(root: Object3D): Rigging {
  const wings: Wing[] = [];
  root.traverse((node) => {
    if (isWingRoot(node)) wings.push({ node, baseX: node.rotation.x });
  });
  const beacon = root.getObjectByName('Beacon');
  const lamps = (beacon ? emissiveMaterials(beacon) : []).map((material) => ({
    material,
    baseIntensity: material.emissiveIntensity,
  }));
  const shades = collectShadeSlots(
    root,
    lamps.map((lamp) => lamp.material),
  );
  return { source: root, wings, lamps, shades };
}

/** First child that is actually shown, so a hidden Suspense twin is never rigged. */
function activeRoot(holder: Object3D): Object3D | null {
  for (const child of holder.children) {
    if (child.visible) return child;
  }
  return null;
}

/**
 * Basis with +Y radially outward and +Z along the direction of travel (made perpendicular to the
 * radial), matching the glTF axes. Returns false when the heading is degenerate.
 */
function computeOrientation(position: Vector3, velocityDir: Vector3, out: Quaternion): boolean {
  radialAxis.copy(position).normalize();
  forwardAxis.copy(velocityDir).addScaledVector(radialAxis, -velocityDir.dot(radialAxis));
  if (forwardAxis.lengthSq() < 1e-8) return false;
  forwardAxis.normalize();
  sideAxis.crossVectors(radialAxis, forwardAxis);
  basis.makeBasis(sideAxis, radialAxis, forwardAxis);
  out.setFromRotationMatrix(basis);
  return true;
}

/** Shortest signed angular difference, so the wings never unwind the long way round. */
function shortestAngle(from: number, to: number): number {
  return MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;
}

/** 0..1 flash: a short half-sine blink once per period, dark otherwise. */
function beaconLevel(seconds: number): number {
  const phase = (seconds % BEACON_PERIOD_SECONDS) / BEACON_PERIOD_SECONDS;
  return phase < BEACON_FLASH_FRACTION ? Math.sin((phase / BEACON_FLASH_FRACTION) * Math.PI) : 0;
}

function createRigState(): RigState {
  return {
    rigging: { source: null, wings: [], lamps: [], shades: [] },
    oriented: false,
    wingAngle: 0,
    hasWingAngle: false,
    shade: 0,
    appear: 0,
    hover: 0,
    hovered: false,
  };
}

export function IssModel() {
  const issFrame = useIssFrame();
  const gl = useThree((state) => state.gl);
  const rigRef = useRef<Group>(null);
  const holderRef = useRef<Group>(null);
  const stateRef = useRef<RigState | null>(null);
  if (stateRef.current === null) stateRef.current = createRigState();

  useEffect(() => {
    const canvas = gl.domElement;
    return () => {
      canvas.style.cursor = '';
    };
  }, [gl]);

  useFrame((frameState, dt) => {
    const rig = rigRef.current;
    const holder = holderRef.current;
    const rigState = stateRef.current;
    if (!rig || !holder || !rigState) return;

    const frame = issFrame.current;
    rig.visible = frame.ready;
    if (!frame.ready) return;
    const { reducedMotion } = useTrackerStore.getState();

    rig.position.copy(frame.position);
    if (computeOrientation(frame.position, frame.velocityDir, targetQuat)) {
      const snap = !rigState.oriented || rig.quaternion.angleTo(targetQuat) > SNAP_ANGLE;
      if (snap) rig.quaternion.copy(targetQuat);
      else rig.quaternion.slerp(targetQuat, dampingBlend(ORIENT_RATE, dt));
      rigState.oriented = true;
    }

    rigState.appear = reducedMotion ? 1 : Math.min(1, rigState.appear + dt / POP_IN_SECONDS);
    const hoverTarget = rigState.hovered ? 1 : 0;
    rigState.hover = reducedMotion
      ? hoverTarget
      : rigState.hover + (hoverTarget - rigState.hover) * dampingBlend(HOVER_RATE, dt);
    const scale = ISS_SCENE_SCALE * easeOutBack(rigState.appear) * (1 + (HOVER_SCALE - 1) * rigState.hover);
    holder.scale.setScalar(Math.max(scale, 1e-4));

    const root = activeRoot(holder);
    if (root && root !== rigState.rigging.source) rigState.rigging = scanRigging(root);
    const { wings, lamps, shades } = rigState.rigging;

    inverseQuat.copy(rig.quaternion).invert();
    sunLocal.copy(frame.sunDir).applyQuaternion(inverseQuat);
    if (Math.hypot(sunLocal.y, sunLocal.z) > MIN_SUN_PLANAR) {
      const target = Math.atan2(sunLocal.z, sunLocal.y);
      const settled = !rigState.hasWingAngle || reducedMotion;
      rigState.wingAngle = settled
        ? target
        : rigState.wingAngle + shortestAngle(rigState.wingAngle, target) * dampingBlend(WING_RATE, dt);
      rigState.hasWingAngle = true;
    }
    for (const wing of wings) wing.node.rotation.x = wing.baseX + rigState.wingAngle;

    // The beacon reads best in the dark, so it glows a little harder while the ISS is in shadow.
    const flash = reducedMotion ? 1 : 0.3 + 1.1 * beaconLevel(frameState.clock.elapsedTime);
    const lampFactor = flash * (frame.sunlit ? 1 : NIGHT_LAMP_BOOST);
    for (const lamp of lamps) lamp.material.emissiveIntensity = lamp.baseIntensity * lampFactor;

    // The scene's lights shine through the planet, so the shadow is painted on the materials instead.
    rigState.shade = nextShade(rigState.shade, frame.sunlit, dt, reducedMotion);
    applyShade(shades, rigState.shade);
  });

  const handleOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (stateRef.current) stateRef.current.hovered = true;
    gl.domElement.style.cursor = 'pointer';
  };
  const handleOut = () => {
    if (stateRef.current) stateRef.current.hovered = false;
    gl.domElement.style.cursor = '';
  };
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    useTrackerStore.getState().setViewMode('follow');
  };

  return (
    <>
      <group
        ref={rigRef}
        visible={false}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        <mesh>
          <sphereGeometry args={[HIT_RADIUS, 12, 8]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        <group ref={holderRef}>
          <ModelErrorBoundary name="iss" fallback={<LowPolyIss />}>
            <Suspense fallback={<LowPolyIss />}>
              <GltfIss />
            </Suspense>
          </ModelErrorBoundary>
        </group>
      </group>
      <IssLabel />
    </>
  );
}
