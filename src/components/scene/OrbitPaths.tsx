import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';

import { altitudeToSceneRadius, geodeticToScene, type Tuple3 } from '@/lib/orbit/frames';
import { orbitalPeriodMinutes, sampleOrbit } from '@/lib/orbit/satrec';
import type { OrbitState, SatRec } from '@/lib/orbit/types';
import { useTrackerStore } from '@/lib/state/tracker-store';

import { useIssFrame } from './iss-frame';
import { PathLine, type PathDash } from './PathLine';
import { PALETTE } from './scene-constants';

const STEP_SECONDS = 20;
/** Resample once the sim clock has moved this far from the last sample (the brief's 30 s). */
const RESAMPLE_MS = 30_000;
/**
 * At 600x playback 30 s of sim time passes in 50 ms; this floor keeps resampling (about 560 SGP4
 * propagations and three new line geometries) from running on every frame.
 */
const MIN_REAL_INTERVAL_MS = 60;
/** Just above the land (r <= 1.04) so the dotted track never sinks into the continents. */
const GROUND_TRACK_RADIUS = 1.045;

/** The dashes crawl along the direction of flight at `speed` scene units per second. */
const FUTURE_DASH: PathDash = { size: 0.055, gap: 0.04, speed: 0.1 };
const GROUND_DASH: PathDash = { size: 0.008, gap: 0.034 };

interface PathSet {
  past: Tuple3[];
  future: Tuple3[];
  ground: Tuple3[];
}

interface SampleMemo {
  satrec: SatRec | null;
  simMs: number;
  realMs: number;
}

const toOrbitPoint = (state: OrbitState): Tuple3 =>
  geodeticToScene(state.latitude, state.longitude, altitudeToSceneRadius(state.altitudeKm));

const toGroundPoint = (state: OrbitState): Tuple3 =>
  geodeticToScene(state.latitude, state.longitude, GROUND_TRACK_RADIUS);

/**
 * One period either side of `centreMs`. Both windows are a whole number of steps and share the
 * centre sample, so the two lines meet without a gap. Paths stay in the Earth-fixed frame, so they
 * spiral westwards by about 23° per orbit instead of closing, which is the true ground track.
 */
function buildPaths(satrec: SatRec, centreMs: number): PathSet {
  const stepMs = STEP_SECONDS * 1000;
  const spanMs = Math.ceil((orbitalPeriodMinutes(satrec) * 60_000) / stepMs) * stepMs;
  const centre = new Date(centreMs);
  const past = sampleOrbit(satrec, new Date(centreMs - spanMs), centre, STEP_SECONDS);
  const future = sampleOrbit(satrec, centre, new Date(centreMs + spanMs), STEP_SECONDS);
  return {
    past: past.map(toOrbitPoint),
    future: future.map(toOrbitPoint),
    ground: future.map(toGroundPoint),
  };
}

export interface OrbitPathsProps {
  satrec: SatRec | null;
}

/** Past (solid, quiet) and future (dashed, coral) orbit at altitude, plus a dotted ground track. */
export function OrbitPaths({ satrec }: OrbitPathsProps) {
  const issFrame = useIssFrame();
  const visible = useTrackerStore((state) => state.layers.orbit);
  const [paths, setPaths] = useState<PathSet | null>(null);
  const memo = useRef<SampleMemo>({ satrec: null, simMs: Number.NaN, realMs: 0 });

  useEffect(() => {
    if (satrec === null) {
      memo.current = { satrec: null, simMs: Number.NaN, realMs: 0 };
      setPaths(null);
    }
  }, [satrec]);

  useFrame(() => {
    if (!visible || satrec === null) return;

    const last = memo.current;
    const simMs = issFrame.current.simTime.getTime();
    const realMs = performance.now();
    const satrecChanged = last.satrec !== satrec;
    const drifted = !(Math.abs(simMs - last.simMs) <= RESAMPLE_MS);
    if (satrecChanged || (drifted && realMs - last.realMs >= MIN_REAL_INTERVAL_MS)) {
      memo.current = { satrec, simMs, realMs };
      setPaths(buildPaths(satrec, simMs));
    }
  });

  if (!visible || paths === null) return null;

  return (
    <group>
      {paths.past.length > 1 && (
        <PathLine points={paths.past} color={PALETTE.inkSoft} lineWidth={2.2} opacity={0.35} />
      )}
      {paths.future.length > 1 && (
        <PathLine
          points={paths.future}
          color={PALETTE.coral}
          lineWidth={2.8}
          opacity={0.95}
          dash={FUTURE_DASH}
        />
      )}
      {paths.ground.length > 1 && (
        <PathLine
          points={paths.ground}
          color={PALETTE.blush}
          lineWidth={2}
          opacity={0.75}
          dash={GROUND_DASH}
        />
      )}
    </group>
  );
}
