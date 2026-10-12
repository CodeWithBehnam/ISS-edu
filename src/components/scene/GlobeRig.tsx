import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import { Quaternion, Vector3, type Group } from 'three';

import { useTrackerStore, type ViewMode } from '@/lib/state/tracker-store';

import { useIssFrame } from './iss-frame';
import {
  AXIAL_TILT_DEG,
  ISO_CAMERA_DIRECTION,
  ISO_SCREEN_UP,
  ISOMETRIC_SPIN_RAD_PER_S,
} from './scene-constants';

const DEG = Math.PI / 180;
/** A hidden tab can hand us seconds in one frame; clamp so nothing lurches when it returns. */
const MAX_STEP_SECONDS = 0.1;

/**
 * How far above the middle of the screen (towards the top) the ISS is presented, in degrees. The
 * orthographic camera separates the station from the ground under it by (orbit radius - ground
 * radius) * sin(angle), so at small angles the model hides the very country it is flying over.
 * 47 degrees lifts it clear of the land beneath (checked over the UK, and over France on northbound
 * and southbound passes) while keeping that land well short of the globe's edge.
 */
const PRESENT_ELEVATION_DEG = 47;

/** Exponential damping rates, per second. A glide eases in over GLIDE_SECONDS after a mode change. */
const FOLLOW_RATE = 5;
const ISOMETRIC_RATE = 3.5;
const GLIDE_RATE = 2.2;
const GLIDE_SECONDS = 1.6;
const REDUCED_MOTION_RATE = 24;

const CAMERA_DIRECTION = new Vector3(...ISO_CAMERA_DIRECTION);
const WORLD_UP = new Vector3(0, 1, 0);

/** World direction the ISS is turned towards: facing the camera, tipped slightly up the screen. */
const PRESENTATION = CAMERA_DIRECTION.clone()
  .multiplyScalar(Math.cos(PRESENT_ELEVATION_DEG * DEG))
  .addScaledVector(new Vector3(...ISO_SCREEN_UP), Math.sin(PRESENT_ELEVATION_DEG * DEG))
  .normalize();

interface RigScratch {
  direction: Vector3;
  north: Vector3;
  fromNorth: Vector3;
  towardsUp: Vector3;
  cross: Vector3;
  roll: Quaternion;
  target: Quaternion;
  tilt: Quaternion;
  spin: Quaternion;
}

interface RigState {
  mode: ViewMode | null;
  /** Seconds since the last mode change or first fix; drives the glide. */
  glide: number;
  spinAngle: number;
  placed: boolean;
  wasReady: boolean;
}

function createScratch(): RigScratch {
  return {
    direction: new Vector3(),
    north: new Vector3(),
    fromNorth: new Vector3(),
    towardsUp: new Vector3(),
    cross: new Vector3(),
    roll: new Quaternion(),
    target: new Quaternion(),
    tilt: new Quaternion().setFromAxisAngle(CAMERA_DIRECTION, -AXIAL_TILT_DEG * DEG),
    spin: new Quaternion(),
  };
}

/** Component of `vector` perpendicular to the unit `axis`, written into `out`. */
function perpendicular(vector: Vector3, axis: Vector3, out: Vector3): Vector3 {
  return out.copy(vector).addScaledVector(axis, -vector.dot(axis));
}

/**
 * Rotation that brings the ISS to the presentation direction with north as close to screen-up as the
 * remaining roll allows. The shortest-arc turn is followed by a roll about the presentation axis that
 * lines the turned north pole up with the screen; the ISS never leaves 51.6 degrees of latitude,
 * so the pole is always well away from that axis and the roll is well conditioned.
 */
function followTarget(issPosition: Vector3, s: RigScratch): Quaternion {
  s.direction.copy(issPosition).normalize();
  s.target.setFromUnitVectors(s.direction, PRESENTATION);
  s.north.copy(WORLD_UP).applyQuaternion(s.target);
  perpendicular(s.north, PRESENTATION, s.fromNorth);
  perpendicular(WORLD_UP, PRESENTATION, s.towardsUp);
  if (s.fromNorth.lengthSq() > 1e-8 && s.towardsUp.lengthSq() > 1e-8) {
    const sine = s.cross.crossVectors(s.fromNorth, s.towardsUp).dot(PRESENTATION);
    s.roll.setFromAxisAngle(PRESENTATION, Math.atan2(sine, s.fromNorth.dot(s.towardsUp)));
    s.target.premultiply(s.roll);
  }
  return s.target;
}

/** Desk-globe pose: spin about the planet's own axis, then lean the axis by the Earth's tilt. */
function isometricTarget(spinAngle: number, s: RigScratch): Quaternion {
  s.spin.setFromAxisAngle(WORLD_UP, spinAngle);
  return s.target.copy(s.tilt).multiply(s.spin);
}

const smoothstep = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

function dampingRate(mode: ViewMode, glideSeconds: number, reducedMotion: boolean): number {
  if (reducedMotion) return REDUCED_MOTION_RATE;
  const steady = mode === 'follow' ? FOLLOW_RATE : ISOMETRIC_RATE;
  return GLIDE_RATE + (steady - GLIDE_RATE) * smoothstep(glideSeconds / GLIDE_SECONDS);
}

/**
 * Turns the Earth-fixed world for the chosen view. Everything that lives in the Earth frame (the
 * planet, the ISS, orbit lines, pins) is a child, so one quaternion moves them all together.
 */
export function GlobeRig({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null);
  const frameRef = useIssFrame();
  const scratch = useMemo(createScratch, []);
  const state = useRef<RigState>({
    mode: null,
    glide: 0,
    spinAngle: 0,
    placed: false,
    wasReady: false,
  });

  // After the frame driver (-1) so the ISS position is current, before lights and models (0).
  useFrame((_, delta) => {
    const rig = group.current;
    if (!rig) return;
    const dt = Math.min(delta, MAX_STEP_SECONDS);
    const { viewMode, reducedMotion } = useTrackerStore.getState();
    const s = state.current;
    const issFrame = frameRef.current;

    if (viewMode !== s.mode) {
      s.mode = viewMode;
      s.glide = 0;
    }
    if (issFrame.ready && !s.wasReady) {
      s.wasReady = true;
      s.glide = 0;
    }
    s.glide += dt;

    if (viewMode === 'free') {
      s.placed = true;
      return;
    }

    // Until the first fix arrives (or if none ever does) 'follow' shows the desk-globe pose instead,
    // then glides to the ISS the moment there is one to follow.
    const following = viewMode === 'follow' && issFrame.ready;
    let target: Quaternion;
    if (following) {
      target = followTarget(issFrame.position, scratch);
    } else {
      if (!reducedMotion) s.spinAngle += ISOMETRIC_SPIN_RAD_PER_S * dt;
      target = isometricTarget(s.spinAngle, scratch);
    }

    if (!s.placed && !following) {
      rig.quaternion.copy(target);
      s.placed = true;
      return;
    }
    s.placed = true;
    const rate = dampingRate(following ? 'follow' : 'isometric', s.glide, reducedMotion);
    rig.quaternion.slerp(target, 1 - Math.exp(-rate * dt));
  }, -0.5);

  return <group ref={group}>{children}</group>;
}
