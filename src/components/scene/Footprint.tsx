import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import { MathUtils, Vector3, type Group, type MeshBasicMaterial } from 'three';

import { EARTH_RADIUS_KM, type Tuple3 } from '@/lib/orbit/frames';
import { useTrackerStore } from '@/lib/state/tracker-store';

import { useIssFrame } from './iss-frame';
import { PALETTE } from './scene-constants';

/** Above the land (r <= 1.04) and below the trees and mountains (r <= 1.09), which poke through. */
const CAP_RADIUS = 1.05;
const RING_RADIUS = 1.052;
const RING_SEGMENTS = 96;
const NOMINAL_ALTITUDE_KM = 420;
/** Rebuild the cap only when the visible radius changes by more than this. */
const REBUILD_THRESHOLD = MathUtils.degToRad(0.2);
const BASE_OPACITY = 0.2;
const BREATH_OPACITY = 0.05;
const BREATH_RATE = 1.6;

const UP = new Vector3(0, 1, 0);
const radial = new Vector3();

/**
 * Angular radius of the horizon circle seen from the real altitude, about 20° at 420 km. The scene
 * exaggerates the ISS height, but the footprint stays honest so it matches what a person on the
 * ground could actually see.
 */
const footprintAngle = (altitudeKm: number): number =>
  Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altitudeKm));

/** Circle of angular radius `alpha` around +Y, drawn on a sphere of radius `radius`. */
function circlePoints(alpha: number, radius: number): Tuple3[] {
  const ringRadius = radius * Math.sin(alpha);
  const height = radius * Math.cos(alpha);
  return Array.from({ length: RING_SEGMENTS + 1 }, (_, index) => {
    const angle = (index / RING_SEGMENTS) * Math.PI * 2;
    return [ringRadius * Math.cos(angle), height, ringRadius * Math.sin(angle)];
  });
}

/** Translucent coral cap under the ISS showing how much of the planet it can see right now. */
export function Footprint() {
  const issFrame = useIssFrame();
  const visible = useTrackerStore((state) => state.layers.footprint);
  const [alpha, setAlpha] = useState(() => footprintAngle(NOMINAL_ALTITUDE_KM));
  const builtAlpha = useRef(alpha);
  const group = useRef<Group>(null);
  const capMaterial = useRef<MeshBasicMaterial>(null);
  const ringPoints = useMemo(() => circlePoints(alpha, RING_RADIUS), [alpha]);

  useFrame(({ clock }) => {
    const root = group.current;
    if (!root) return;
    const frame = issFrame.current;
    root.visible = frame.ready;
    if (!frame.ready || frame.state === null) return;

    // The cap is built around +Y once; turning the group aims it at the sub-satellite point.
    radial.copy(frame.position).normalize();
    root.quaternion.setFromUnitVectors(UP, radial);

    const target = footprintAngle(frame.state.altitudeKm);
    if (Math.abs(target - builtAlpha.current) > REBUILD_THRESHOLD) {
      builtAlpha.current = target;
      setAlpha(target);
    }

    if (capMaterial.current) {
      const breathing = useTrackerStore.getState().reducedMotion
        ? 0
        : Math.sin(clock.elapsedTime * BREATH_RATE);
      capMaterial.current.opacity = BASE_OPACITY + BREATH_OPACITY * breathing;
    }
  });

  if (!visible) return null;

  return (
    <group ref={group} visible={false}>
      <mesh renderOrder={1}>
        <sphereGeometry args={[CAP_RADIUS, 72, 8, 0, Math.PI * 2, 0, alpha]} />
        <meshBasicMaterial
          ref={capMaterial}
          color={PALETTE.coral}
          transparent
          opacity={BASE_OPACITY}
          depthWrite={false}
        />
      </mesh>
      <Line
        points={ringPoints}
        color={PALETTE.coral}
        lineWidth={8}
        transparent
        opacity={0.18}
        depthWrite={false}
      />
      <Line
        points={ringPoints}
        color={PALETTE.coral}
        lineWidth={2.2}
        transparent
        opacity={0.9}
        depthWrite={false}
      />
    </group>
  );
}
