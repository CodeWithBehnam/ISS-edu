import { createContext, useContext, type MutableRefObject } from 'react';
import { Vector3 } from 'three';

import type { OrbitState } from '@/lib/orbit/types';

/**
 * Per-frame ISS snapshot shared inside the R3F tree. Written once per frame by
 * <IssFrameDriver> (useFrame priority -1) and read by everything else in useFrame,
 * so 60 fps motion never triggers React re-renders.
 */
export interface IssFrame {
  /** Current simulation time. */
  simTime: Date;
  /** SGP4 state, or null when neither a TLE nor telemetry is available yet. */
  state: OrbitState | null;
  /** ISS position in the Earth-fixed scene frame (exaggerated altitude). */
  position: Vector3;
  /** Unit vector of travel direction in the scene frame. */
  velocityDir: Vector3;
  /** Unit vector from Earth's centre towards the Sun in the scene frame. */
  sunDir: Vector3;
  /** True when the ISS is outside Earth's shadow. */
  sunlit: boolean;
  /** False until the first valid position has been written. */
  ready: boolean;
}

export function createIssFrame(): IssFrame {
  return {
    simTime: new Date(),
    state: null,
    position: new Vector3(0, 1.3, 0),
    velocityDir: new Vector3(1, 0, 0),
    sunDir: new Vector3(1, 0, 0),
    sunlit: true,
    ready: false,
  };
}

export const IssFrameContext = createContext<MutableRefObject<IssFrame> | null>(null);

export function useIssFrame(): MutableRefObject<IssFrame> {
  const ref = useContext(IssFrameContext);
  if (!ref) throw new Error('useIssFrame must be used inside <IssFrameProvider>');
  return ref;
}
