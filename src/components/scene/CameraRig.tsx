import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type ElementRef } from 'react';
import { OrthographicCamera, Vector3 } from 'three';

import { useTrackerStore } from '@/lib/state/tracker-store';
import { frameFactorFor } from '@/lib/time/damping';

import {
  CAMERA_DISTANCE,
  FIT_RADIUS,
  FRAME_CENTRE_Y,
  FRAME_HALF_WIDTH,
  FRAME_MARGIN,
  ISO_CAMERA_DIRECTION,
} from './scene-constants';

const MAX_STEP_SECONDS = 0.1;
/** OrbitControls applies this fraction of the remaining drag motion per update, tuned at 60 Hz. */
const DRAG_DAMPING_AT_60HZ = 0.08;
/** drei updates the controls at priority -1; this runs just before it so the factor is current. */
const DAMPING_PRIORITY = -2;
/** Easing back to the default framing, per second. */
const RESET_RATE = 5;
const RESET_RATE_REDUCED_MOTION = 30;
const POSITION_EPSILON_SQ = 1e-6;
const ZOOM_EPSILON = 1e-3;

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 3;
/** Keeps the camera at or just under the tile edge: from lower down the stand would hide the globe. */
const MAX_POLAR_ANGLE = Math.PI * 0.53;
const MIN_POLAR_ANGLE = Math.PI * 0.08;

/**
 * Sizes the orthographic frustum so the whole diorama fits whatever the canvas shape: the height is
 * what matters on a landscape screen, the width on a portrait one. The frustum is shifted instead of
 * the camera being moved so that orbiting in free mode still pivots about the globe's centre.
 */
function fitFrustum(camera: OrthographicCamera, aspect: number): void {
  const halfHeight = Math.max(FIT_RADIUS * FRAME_MARGIN, (FRAME_HALF_WIDTH * FRAME_MARGIN) / aspect);
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = FRAME_CENTRE_Y + halfHeight;
  camera.bottom = FRAME_CENTRE_Y - halfHeight;
  camera.updateProjectionMatrix();
}

/**
 * True isometric camera. It stays on its default framing in every mode except 'free', which hands
 * it to OrbitControls (rotate and zoom, no pan). Leaving free mode, or pressing reset, eases it home.
 */
export function CameraRig() {
  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const viewMode = useTrackerStore((state) => state.viewMode);
  const resetToken = useTrackerStore((state) => state.cameraResetToken);
  const easing = useRef(false);
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const home = useMemo(
    () => new Vector3(...ISO_CAMERA_DIRECTION).multiplyScalar(CAMERA_DISTANCE),
    [],
  );

  useLayoutEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return;
    fitFrustum(camera, width / Math.max(height, 1));
  }, [camera, width, height]);

  // Any change of mode, and every reset request, sends the camera home; a drag in free mode cancels it.
  useEffect(() => {
    easing.current = true;
  }, [viewMode, resetToken]);

  useFrame((_, delta) => {
    if (!easing.current || !(camera instanceof OrthographicCamera)) return;
    const { reducedMotion } = useTrackerStore.getState();
    const rate = reducedMotion ? RESET_RATE_REDUCED_MOTION : RESET_RATE;
    const blend = 1 - Math.exp(-rate * Math.min(delta, MAX_STEP_SECONDS));

    camera.position.lerp(home, blend).setLength(CAMERA_DISTANCE);
    camera.zoom += (1 - camera.zoom) * blend;
    const arrived =
      camera.position.distanceToSquared(home) < POSITION_EPSILON_SQ &&
      Math.abs(camera.zoom - 1) < ZOOM_EPSILON;
    if (arrived) {
      camera.position.copy(home);
      camera.zoom = 1;
      easing.current = false;
    }
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  });

  // The library damps once per update, so inertia would last longer on a slow screen than a fast one.
  useFrame((_, delta) => {
    const active = controls.current;
    if (active) active.dampingFactor = frameFactorFor(DRAG_DAMPING_AT_60HZ, Math.min(delta, MAX_STEP_SECONDS));
  }, DAMPING_PRIORITY);

  // OrbitControls claims touch gestures for the canvas while mounted, so it exists only in free mode:
  // otherwise a phone user could not scroll the page past the 3D stage.
  if (viewMode !== 'free') return null;
  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      enableDamping
      dampingFactor={DRAG_DAMPING_AT_60HZ}
      rotateSpeed={0.7}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      minPolarAngle={MIN_POLAR_ANGLE}
      maxPolarAngle={MAX_POLAR_ANGLE}
      onStart={() => {
        easing.current = false;
      }}
    />
  );
}
