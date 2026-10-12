import { eciToEcf, gstime, propagate } from 'satellite.js';
import { normaliseLongitude } from '@/lib/orbit/frames';
import type { GeoPoint, SatRec, Vec3 } from '@/lib/orbit/types';

const DEG = Math.PI / 180;
const MS_PER_DAY = 86_400_000;
const JULIAN_DATE_AT_UNIX_EPOCH = 2_440_587.5;
const JULIAN_DATE_AT_J2000 = 2_451_545;

/** WGS-84 equatorial radius: the radius of the cylindrical umbra. */
const SHADOW_RADIUS_KM = 6378.137;

/** Transition times are bisected until the bracket is this narrow. */
const TRANSITION_TOLERANCE_MS = 1000;

export interface ShadowTransition {
  kind: 'enter-shadow' | 'exit-shadow';
  /** First instant (to within one second) at which the new state holds. */
  at: Date;
}

function daysSinceJ2000(time: Date): number {
  return time.getTime() / MS_PER_DAY + JULIAN_DATE_AT_UNIX_EPOCH - JULIAN_DATE_AT_J2000;
}

/**
 * Unit vector from the Earth to the Sun in the equatorial inertial frame, from the Astronomical
 * Almanac low-precision formulae (about 0.01° for 1950 to 2050, ample for lighting and terminators).
 */
export function sunDirectionEci(time: Date): Vec3 {
  const n = daysSinceJ2000(time);
  const meanAnomaly = (357.528 + 0.9856003 * n) * DEG;
  const eclipticLongitude =
    (280.46 + 0.9856474 * n + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * DEG;
  const obliquity = (23.439 - 0.0000004 * n) * DEG;
  const sinLongitude = Math.sin(eclipticLongitude);
  return {
    x: Math.cos(eclipticLongitude),
    y: Math.cos(obliquity) * sinLongitude,
    z: Math.sin(obliquity) * sinLongitude,
  };
}

/** Sun direction in the Earth-fixed frame (x to lon 0, y to lon 90° E, z north). */
export function sunDirectionEcf(time: Date): Vec3 {
  return eciToEcf(sunDirectionEci(time), gstime(time));
}

export function subsolarPoint(time: Date): GeoPoint {
  const sun = sunDirectionEcf(time);
  return {
    latitude: Math.asin(sun.z) / DEG,
    longitude: normaliseLongitude(Math.atan2(sun.y, sun.x) / DEG),
  };
}

/** Sun elevation above the local horizon, degrees, treating the Earth as a sphere. */
export function sunElevationDeg(point: GeoPoint, time: Date): number {
  const sun = sunDirectionEcf(time);
  const latitude = point.latitude * DEG;
  const longitude = point.longitude * DEG;
  const cosLatitude = Math.cos(latitude);
  const alongVertical =
    sun.x * cosLatitude * Math.cos(longitude) + sun.y * cosLatitude * Math.sin(longitude) + sun.z * Math.sin(latitude);
  // Rounding can push the dot product of two unit vectors fractionally past 1.
  return Math.asin(Math.max(-1, Math.min(1, alongVertical))) / DEG;
}

/**
 * Cylindrical umbra test. The penumbra of a LEO orbit lasts only seconds, so the simpler
 * model is indistinguishable at the precision the UI shows.
 */
export function isInEarthShadow(eciKm: Vec3, time: Date): boolean {
  const sun = sunDirectionEci(time);
  const alongSun = eciKm.x * sun.x + eciKm.y * sun.y + eciKm.z * sun.z;
  if (alongSun >= 0) return false;
  const distanceSq = eciKm.x * eciKm.x + eciKm.y * eciKm.y + eciKm.z * eciKm.z;
  return distanceSq - alongSun * alongSun < SHADOW_RADIUS_KM * SHADOW_RADIUS_KM;
}

/** Shadow state at an instant, or null when SGP4 cannot propagate there. */
function shadowedAt(satrec: SatRec, ms: number): boolean | null {
  const time = new Date(ms);
  const { position } = propagate(satrec, time);
  if (typeof position === 'boolean') return null;
  return isInEarthShadow(position, time);
}

/** Narrows a bracket whose ends differ in shadow state down to the tolerance; returns the later end. */
function bisectTransition(satrec: SatRec, beforeMs: number, afterMs: number, beforeState: boolean): number {
  let before = beforeMs;
  let after = afterMs;
  while (after - before > TRANSITION_TOLERANCE_MS) {
    const middle = Math.round((before + after) / 2);
    if (shadowedAt(satrec, middle) === beforeState) before = middle;
    else after = middle;
  }
  return after;
}

/**
 * Next umbra entry or exit after `from`, or null when none falls inside the horizon (or SGP4 fails).
 * The reported `at` is the first instant of the new state, so chaining calls from `at` alternates kinds.
 */
export function nextShadowTransition(
  satrec: SatRec,
  from: Date,
  horizonMinutes = 120,
  stepSeconds = 10,
): ShadowTransition | null {
  if (!(stepSeconds > 0)) throw new RangeError(`stepSeconds must be positive, received ${stepSeconds}`);
  const startMs = from.getTime();
  const endMs = startMs + horizonMinutes * 60_000;
  const stepMs = stepSeconds * 1000;
  const initial = shadowedAt(satrec, startMs);
  if (initial === null) return null;

  for (let beforeMs = startMs; beforeMs < endMs; beforeMs += stepMs) {
    const afterMs = Math.min(beforeMs + stepMs, endMs);
    const state = shadowedAt(satrec, afterMs);
    if (state === null) return null;
    if (state !== initial) {
      const at = bisectTransition(satrec, beforeMs, afterMs, initial);
      return { kind: state ? 'enter-shadow' : 'exit-shadow', at: new Date(at) };
    }
  }
  return null;
}
