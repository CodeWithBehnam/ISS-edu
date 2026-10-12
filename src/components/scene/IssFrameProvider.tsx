import { useFrame } from '@react-three/fiber';
import { degreesToRadians, ecfToEci, geodeticToEcf, gstime } from 'satellite.js';
import { useMemo, useRef, type ReactNode } from 'react';
import { Vector3 } from 'three';

import type { LiveTelemetry } from '@/lib/api/iss-telemetry';
import { isInEarthShadow } from '@/lib/astro/sun';
import { altitudeToSceneRadius, geodeticToScene } from '@/lib/orbit/frames';
import { propagateState, sceneTrackDirection } from '@/lib/orbit/satrec';
import type { OrbitState, SatRec } from '@/lib/orbit/types';
import { useTrackerStore } from '@/lib/state/tracker-store';
import { currentSimMs } from '@/lib/time/sim-clock';

import { createIssFrame, IssFrameContext, type IssFrame } from './iss-frame';
import { sunReferenceTime, writeSunDirection } from './sun-frame';

/**
 * Direction, Sun and shadow change slowly (about 0.07° of orbit per second), so they are refreshed
 * at this sim-time interval instead of every frame. Position is still updated on every frame.
 */
const SLOW_UPDATE_MS = 500;
/** Ignore telemetry fixes closer together than this (scene units) when deriving a heading. */
const MIN_HEADING_DISTANCE = 1e-5;

interface DriverScratch {
  /** Sim time of the last slow update. */
  slowMs: number;
  /** Sim time of the last Sun update, which runs even before any orbit data exists. */
  sunMs: number;
  slowSatrec: SatRec | null;
  /** Telemetry object whose fix is already in the frame. */
  telemetry: LiveTelemetry | null;
  previousFix: Vector3;
  hasPreviousFix: boolean;
}

const radial = new Vector3();
const delta = new Vector3();
const nextFix = new Vector3();

function createScratch(): DriverScratch {
  return {
    slowMs: Number.NaN,
    sunMs: Number.NaN,
    slowSatrec: null,
    telemetry: null,
    previousFix: new Vector3(),
    hasPreviousFix: false,
  };
}

/** Telemetry carries no inertial velocity vector, so eciVelocity stays zero; only speedKps is real. */
function stateFromTelemetry(telemetry: LiveTelemetry): OrbitState {
  const gmst = gstime(telemetry.time);
  const ecf = geodeticToEcf({
    latitude: degreesToRadians(telemetry.latitude),
    longitude: degreesToRadians(telemetry.longitude),
    height: telemetry.altitudeKm,
  });
  const eci = ecfToEci(ecf, gmst);
  return {
    time: new Date(telemetry.time.getTime()),
    latitude: telemetry.latitude,
    longitude: telemetry.longitude,
    altitudeKm: telemetry.altitudeKm,
    speedKps: telemetry.speedKps,
    eci: { x: eci.x, y: eci.y, z: eci.z },
    eciVelocity: { x: 0, y: 0, z: 0 },
    gmst,
  };
}

/** Heading from two successive fixes, projected onto the tangent plane at the newer one. */
function writeHeading(from: Vector3, to: Vector3, out: Vector3): void {
  delta.subVectors(to, from);
  radial.copy(to).normalize();
  delta.addScaledVector(radial, -delta.dot(radial));
  const length = delta.length();
  if (length > MIN_HEADING_DISTANCE) out.copy(delta).multiplyScalar(1 / length);
}

function driveFromSatrec(frame: IssFrame, scratch: DriverScratch, satrec: SatRec, simMs: number): void {
  const state = propagateState(satrec, frame.simTime);
  // On failure the previous snapshot stays, so the model freezes rather than jumping to the origin.
  if (state === null) return;

  frame.state = state;
  const [x, y, z] = geodeticToScene(
    state.latitude,
    state.longitude,
    altitudeToSceneRadius(state.altitudeKm),
  );
  frame.position.set(x, y, z);
  frame.ready = true;

  const due = scratch.slowSatrec !== satrec || !(Math.abs(simMs - scratch.slowMs) < SLOW_UPDATE_MS);
  if (!due) return;
  scratch.slowSatrec = satrec;
  scratch.slowMs = simMs;

  const heading = sceneTrackDirection(satrec, frame.simTime);
  if (heading !== null) frame.velocityDir.set(heading[0], heading[1], heading[2]);
  frame.sunlit = !isInEarthShadow(state.eci, frame.simTime);
}

function driveFromTelemetry(frame: IssFrame, scratch: DriverScratch, telemetry: LiveTelemetry): void {
  if (scratch.telemetry === telemetry) return;
  scratch.telemetry = telemetry;
  frame.state = stateFromTelemetry(telemetry);
  const [x, y, z] = geodeticToScene(
    telemetry.latitude,
    telemetry.longitude,
    altitudeToSceneRadius(telemetry.altitudeKm),
  );
  nextFix.set(x, y, z);
  if (scratch.hasPreviousFix) writeHeading(scratch.previousFix, nextFix, frame.velocityDir);
  scratch.previousFix.copy(nextFix);
  scratch.hasPreviousFix = true;
  frame.position.copy(nextFix);
  frame.sunlit = telemetry.visibility === 'daylight';
  frame.ready = true;
}

export interface IssFrameProviderProps {
  satrec: SatRec | null;
  fallbackTelemetry: LiveTelemetry | null;
  children: ReactNode;
}

/**
 * Owns the per-frame ISS snapshot and refreshes it before anything else in the frame (priority -1),
 * so every consumer reads a consistent position, heading and Sun direction without re-rendering.
 */
export function IssFrameProvider({ satrec, fallbackTelemetry, children }: IssFrameProviderProps) {
  const frameRef = useMemo<{ current: IssFrame }>(() => ({ current: createIssFrame() }), []);
  const scratch = useRef<DriverScratch | null>(null);
  if (scratch.current === null) scratch.current = createScratch();

  useFrame(() => {
    const driver = scratch.current;
    if (driver === null) return;
    const frame = frameRef.current;
    const simMs = currentSimMs(useTrackerStore.getState().clock, Date.now());
    frame.simTime.setTime(simMs);

    if (!(Math.abs(simMs - driver.sunMs) < SLOW_UPDATE_MS)) {
      driver.sunMs = simMs;
      writeSunDirection(frame, sunReferenceTime(frame.simTime, satrec !== null, fallbackTelemetry));
    }

    if (satrec !== null) driveFromSatrec(frame, driver, satrec, simMs);
    else if (fallbackTelemetry !== null) driveFromTelemetry(frame, driver, fallbackTelemetry);
  }, -1);

  return <IssFrameContext.Provider value={frameRef}>{children}</IssFrameContext.Provider>;
}
