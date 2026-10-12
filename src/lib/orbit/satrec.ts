import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  gstime,
  propagate,
  twoline2satrec,
} from 'satellite.js';
import { altitudeToSceneRadius, geodeticToScene, normaliseLongitude, type Tuple3 } from './frames';
import type { OrbitState, SatRec, TleRecord, Vec3 } from './types';

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
/** Julian date of 1970-01-01T00:00:00Z. */
const UNIX_EPOCH_JULIAN_DATE = 2_440_587.5;

/** Zero-based slice of TLE line 2 holding the revolution number (columns 64-68). */
const REVOLUTION_FIELD_START = 63;
const REVOLUTION_FIELD_END = 68;

/** Meanings of satrec.error as set by satellite.js sgp4init and sgp4. */
const SGP4_ERRORS: Readonly<Record<number, string>> = {
  1: 'mean eccentricity out of range',
  2: 'mean motion is not positive',
  3: 'perturbed eccentricity out of range',
  4: 'semi-latus rectum is negative',
  5: 'epoch elements are sub-orbital',
  6: 'satellite has decayed',
};

function isVec3(value: unknown): value is Vec3 {
  if (typeof value !== 'object' || value === null) return false;
  const { x, y, z } = value as Record<string, unknown>;
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z);
}

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive, finite number of seconds (received ${value})`);
  }
}

/** Parses a TLE and initialises SGP4; throws instead of returning a record that cannot propagate. */
export function createSatrec(tle: Pick<TleRecord, 'line1' | 'line2'>): SatRec {
  const satrec = twoline2satrec(tle.line1, tle.line2);
  if (satrec.error !== 0) {
    const reason = SGP4_ERRORS[satrec.error] ?? 'unknown error';
    throw new Error(`SGP4 initialisation failed (code ${satrec.error}: ${reason})`);
  }
  // satellite.js parses with parseFloat, so malformed lines surface as NaN rather than an error code.
  if (!Number.isFinite(satrec.no) || satrec.no <= 0 || !Number.isFinite(satrec.jdsatepoch)) {
    throw new Error('TLE could not be parsed: mean motion or epoch is not a valid number');
  }
  return satrec;
}

export function tleEpoch(satrec: SatRec): Date {
  return new Date(Math.round((satrec.jdsatepoch - UNIX_EPOCH_JULIAN_DATE) * MS_PER_DAY));
}

/** SGP4 state at `time`, or null when the propagator rejects it (for example a decayed orbit). */
export function propagateState(satrec: SatRec, time: Date): OrbitState | null {
  if (!Number.isFinite(time.getTime())) return null;

  // On some error paths satellite.js returns an array of falses instead of the documented object.
  const { position, velocity } = propagate(satrec, time);
  if (!isVec3(position) || !isVec3(velocity)) return null;

  const gmst = gstime(time);
  const geodetic = eciToGeodetic(position, gmst);
  if (
    !Number.isFinite(geodetic.latitude) ||
    !Number.isFinite(geodetic.longitude) ||
    !Number.isFinite(geodetic.height)
  ) {
    return null;
  }

  return {
    time: new Date(time.getTime()),
    latitude: degreesLat(geodetic.latitude),
    longitude: normaliseLongitude(degreesLong(geodetic.longitude)),
    altitudeKm: geodetic.height,
    speedKps: Math.hypot(velocity.x, velocity.y, velocity.z),
    eci: { x: position.x, y: position.y, z: position.z },
    eciVelocity: { x: velocity.x, y: velocity.y, z: velocity.z },
    gmst,
  };
}

/** Mean-motion period; satrec.no is in radians per minute. */
export function orbitalPeriodMinutes(satrec: SatRec): number {
  return (2 * Math.PI) / satrec.no;
}

function parseEpochRevolution(line2: string): number {
  const field = line2.slice(REVOLUTION_FIELD_START, REVOLUTION_FIELD_END).trim();
  if (!/^\d+$/.test(field)) {
    throw new Error(`TLE line 2 has no valid revolution number in columns 64-68 (found "${field}")`);
  }
  return Number.parseInt(field, 10);
}

/**
 * Revolution count at `time`: the TLE's epoch revolution plus whole periods elapsed since the epoch.
 * Revolutions are counted from the epoch rather than from the ascending node, so it can differ by one
 * from the official count for part of each orbit.
 */
export function revolutionNumberAt(satrec: SatRec, line2: string, time: Date): number {
  const elapsedMinutes = (time.getTime() - tleEpoch(satrec).getTime()) / MS_PER_MINUTE;
  const elapsedRevolutions = Math.floor(elapsedMinutes / orbitalPeriodMinutes(satrec));
  return parseEpochRevolution(line2) + elapsedRevolutions;
}

/** States from `start` every `stepSeconds`, up to and including `end` when it falls on a step. */
export function sampleOrbit(
  satrec: SatRec,
  start: Date,
  end: Date,
  stepSeconds: number,
): OrbitState[] {
  assertPositiveFinite(stepSeconds, 'stepSeconds');
  const startMs = start.getTime();
  const spanMs = end.getTime() - startMs;
  // Also rejects NaN dates, since NaN >= 0 is false.
  if (!(spanMs >= 0)) return [];

  const stepMs = stepSeconds * 1000;
  const count = Math.floor(spanMs / stepMs) + 1;
  return Array.from({ length: count }, (_, index) =>
    propagateState(satrec, new Date(startMs + index * stepMs)),
  ).filter((state): state is OrbitState => state !== null);
}

function scenePositionAt(satrec: SatRec, time: Date): Tuple3 | null {
  const state = propagateState(satrec, time);
  if (state === null) return null;
  return geodeticToScene(state.latitude, state.longitude, altitudeToSceneRadius(state.altitudeKm));
}

/**
 * Unit direction of travel in the Earth-fixed scene frame (so it includes the ground moving under the
 * orbit). A central difference keeps the direction centred on `time`.
 */
export function sceneTrackDirection(satrec: SatRec, time: Date, dtSeconds = 1): Tuple3 | null {
  assertPositiveFinite(dtSeconds, 'dtSeconds');
  const centreMs = time.getTime();
  const halfStepMs = (dtSeconds * 1000) / 2;
  const before = scenePositionAt(satrec, new Date(centreMs - halfStepMs));
  const after = scenePositionAt(satrec, new Date(centreMs + halfStepMs));
  if (before === null || after === null) return null;

  const dx = after[0] - before[0];
  const dy = after[1] - before[1];
  const dz = after[2] - before[2];
  const length = Math.hypot(dx, dy, dz);
  if (length === 0) return null;
  return [dx / length, dy / length, dz / length];
}
