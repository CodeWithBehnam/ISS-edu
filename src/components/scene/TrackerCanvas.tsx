import { useGLTF } from '@react-three/drei';
import { Canvas, type RootState } from '@react-three/fiber';
import { memo } from 'react';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';

import type { LiveTelemetry } from '@/lib/api/iss-telemetry';
import { clientLog } from '@/lib/observability/client-log';
import type { SatRec } from '@/lib/orbit/types';

import { CameraRig } from './CameraRig';
import { EarthModel } from './EarthModel';
import { Footprint } from './Footprint';
import { GlobeRig } from './GlobeRig';
import { IssFrameProvider } from './IssFrameProvider';
import { IssModel } from './IssModel';
import { ObserverPin } from './ObserverPin';
import { OrbitPaths } from './OrbitPaths';
import { CAMERA_DISTANCE, ISO_CAMERA_DIRECTION, MODEL_URLS } from './scene-constants';
import { StandModel } from './StandModel';
import { SunRig } from './SunRig';

// The ISS model is loaded by IssModel, but fetching it alongside the planet saves a round trip.
useGLTF.preload(MODEL_URLS.iss, false);

export interface TrackerCanvasProps {
  satrec: SatRec | null;
  /** Used for the position until a TLE has been fetched. */
  fallbackTelemetry: LiveTelemetry | null;
}

const CAMERA_POSITION: [number, number, number] = [
  ISO_CAMERA_DIRECTION[0] * CAMERA_DISTANCE,
  ISO_CAMERA_DIRECTION[1] * CAMERA_DISTANCE,
  ISO_CAMERA_DIRECTION[2] * CAMERA_DISTANCE,
];

/**
 * `manual` hands the frustum to CameraRig, which fits it to the canvas shape; the numbers here only
 * give the camera a sane volume for the frame before CameraRig's layout effect runs.
 */
const CAMERA_PROPS = {
  manual: true,
  position: CAMERA_POSITION,
  near: 1,
  far: CAMERA_DISTANCE * 2,
  zoom: 1,
  left: -2,
  right: 2,
  top: 2,
  bottom: -2,
};

/**
 * Module-level so Canvas sees the same object on every render: an inline literal would be re-applied
 * to the renderer each time the parent renders.
 */
const GL_OPTIONS = {
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
  toneMapping: ACESFilmicToneMapping,
  outputColorSpace: SRGBColorSpace,
} as const;

/** WebGL can drop the context on mobile when the tab is backgrounded; three restores it on its own. */
function watchContext({ gl }: RootState): void {
  const element = gl.domElement;
  element.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    clientLog('warn', 'webgl-context-lost');
  });
  element.addEventListener('webglcontextrestored', () => {
    clientLog('info', 'webgl-context-restored');
  });
}

/**
 * The isometric diorama: a transparent orthographic canvas, so the page's pastel gradient shows
 * behind the globe. Hooks that use React Query live outside; this tree only gets plain props.
 * A failure to start or run the scene is handled by the stage boundary in TrackerApp, which swaps in
 * the flat map. Memoised because the parent re-renders with every live-data refresh.
 */
export const TrackerCanvas = memo(function TrackerCanvas({ satrec, fallbackTelemetry }: TrackerCanvasProps) {
  return (
    <Canvas
      orthographic
      shadows="soft"
      dpr={[1, 2]}
      camera={CAMERA_PROPS}
      gl={GL_OPTIONS}
      onCreated={watchContext}
      role="img"
      aria-label="Interactive 3D globe showing the International Space Station orbiting Earth"
    >
      <CameraRig />
      <IssFrameProvider satrec={satrec} fallbackTelemetry={fallbackTelemetry}>
        <GlobeRig>
          <SunRig />
          <EarthModel />
          <IssModel />
          <OrbitPaths satrec={satrec} />
          <Footprint />
          <ObserverPin />
        </GlobeRig>
        <StandModel />
      </IssFrameProvider>
    </Canvas>
  );
});
