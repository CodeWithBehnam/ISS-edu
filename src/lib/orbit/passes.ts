import { degreesToRadians, ecfToLookAngles, eciToEcf, gstime, propagate } from 'satellite.js';
import { isInEarthShadow, sunElevationDeg } from '@/lib/astro/sun';
import type { SatRec, Vec3 } from '@/lib/orbit/types';

export interface ObserverSite {
  latitude: number;
  longitude: number;
  heightKm?: number;
}

export interface PassPoint {
  time: Date;
  elevationDeg: number;
  azimuthDeg: number;
  rangeKm: number;
}

export interface Pass {
  /** Stable across recomputation: derived from the start time rounded to the minute. */
  id: string;
  /** Rise (AOS) at the minimum elevation. For an in-progress pass this is before the search start. */
  start: PassPoint;
  peak: PassPoint;
  /** Set (LOS) at the minimum elevation. */
  end: PassPoint;
  durationSeconds: number;
  maxElevationDeg: number;
  /** True when the station was already above the minimum elevation at the search start. */
  inProgress: boolean;
  /** Naked-eye visible: high enough, sunlit, and the observer in twilight or darkness. */
  visible: boolean;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface FindPassesOptions {
  days?: number;
  minElevationDeg?: number;
  stepSeconds?: number;
  maxPasses?: number;
}

interface SkySample {
  point: PassPoint;
  eci: Vec3;
}

type SkyAt = (ms: number) => SkySample | null;

interface PassWindow {
  aosMs: number;
  losMs: number;
  inProgress: boolean;
}

const RAD_TO_DEG = 180 / Math.PI;
const MS_PER_DAY = 86_400_000;
const BELOW_HORIZON_DEG = -90;

/** Elevation floor and Sun depression that make a pass visible to the naked eye. */
const VISIBLE_MIN_ELEVATION_DEG = 10;
const VISIBLE_MAX_SUN_ELEVATION_DEG = -6;
const VISIBILITY_SAMPLE_MS = 10_000;

/** AOS and LOS are bisected to a bracket this narrow, well inside the contract's one second. */
const CROSSING_TOLERANCE_MS = 250;
const PEAK_TOLERANCE_MS = 200;
/** No LEO pass lasts this long; it bounds backward and overrun scans on pathological input. */
const MAX_PASS_MS = 30 * 60_000;

const INVERSE_GOLDEN_RATIO = (Math.sqrt(5) - 1) / 2;

function normaliseAzimuth(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function skyAt(satrec: SatRec, observer: ObserverSite, ms: number): SkySample | null {
  const time = new Date(ms);
  const { position } = propagate(satrec, time);
  if (typeof position === 'boolean') return null;
  const look = ecfToLookAngles(
    {
      longitude: degreesToRadians(observer.longitude),
      latitude: degreesToRadians(observer.latitude),
      height: observer.heightKm ?? 0,
    },
    eciToEcf(position, gstime(time)),
  );
  return {
    eci: position,
    point: {
      time,
      elevationDeg: look.elevation * RAD_TO_DEG,
      azimuthDeg: normaliseAzimuth(look.azimuth * RAD_TO_DEG),
      rangeKm: look.rangeSat,
    },
  };
}

export function lookAnglesAt(satrec: SatRec, observer: ObserverSite, time: Date): PassPoint | null {
  return skyAt(satrec, observer, time.getTime())?.point ?? null;
}

/** Bisects between an outside and an inside instant; returns the inside end of the final bracket. */
function refineCrossing(isInside: (ms: number) => boolean, outsideMs: number, insideMs: number): number {
  let outside = outsideMs;
  let inside = insideMs;
  while (Math.abs(inside - outside) > CROSSING_TOLERANCE_MS) {
    const middle = Math.round((inside + outside) / 2);
    if (isInside(middle)) inside = middle;
    else outside = middle;
  }
  return inside;
}

/** Golden-section search for the maximum of a unimodal function; returns the abscissa. */
function maximise(f: (x: number) => number, low: number, high: number, tolerance: number): number {
  let a = low;
  let b = high;
  let c = b - INVERSE_GOLDEN_RATIO * (b - a);
  let d = a + INVERSE_GOLDEN_RATIO * (b - a);
  let fc = f(c);
  let fd = f(d);
  while (b - a > tolerance) {
    if (fc > fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - INVERSE_GOLDEN_RATIO * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + INVERSE_GOLDEN_RATIO * (b - a);
      fd = f(d);
    }
  }
  return (a + b) / 2;
}

/** Walks back from an in-progress moment to the rise, so the pass geometry is complete. */
function findEarlierRise(isUp: (ms: number) => boolean, fromMs: number, stepMs: number): number {
  for (let ms = fromMs - stepMs; ms >= fromMs - MAX_PASS_MS; ms -= stepMs) {
    if (!isUp(ms)) return refineCrossing(isUp, ms, ms + stepMs);
  }
  return fromMs;
}

/**
 * Coarse scan for contiguous spans above the threshold. A pass still running at the horizon is
 * followed to its set. A pass that rises and sets between two samples (peak barely over the
 * threshold) can be missed; such grazing passes are too low to see anyway.
 */
function scanWindows(
  isUp: (ms: number) => boolean,
  startMs: number,
  spanMs: number,
  stepMs: number,
  limit: number,
): PassWindow[] {
  const windows: PassWindow[] = [];
  const horizonMs = startMs + spanMs;
  let inProgress = isUp(startMs);
  let aosMs: number | null = inProgress ? findEarlierRise(isUp, startMs, stepMs) : null;
  let previousMs = startMs;

  for (let ms = startMs + stepMs; windows.length < limit; ms += stepMs) {
    if (ms > (aosMs === null ? horizonMs : horizonMs + MAX_PASS_MS)) break;
    const up = isUp(ms);
    if (aosMs === null && up) {
      aosMs = refineCrossing(isUp, previousMs, ms);
    } else if (aosMs !== null && !up) {
      windows.push({ aosMs, losMs: refineCrossing(isUp, ms, previousMs), inProgress });
      aosMs = null;
      inProgress = false;
    }
    previousMs = ms;
  }
  return windows;
}

function isVisibleMoment(sample: SkySample, observer: ObserverSite): boolean {
  const { time, elevationDeg } = sample.point;
  return (
    elevationDeg >= VISIBLE_MIN_ELEVATION_DEG &&
    sunElevationDeg(observer, time) < VISIBLE_MAX_SUN_ELEVATION_DEG &&
    !isInEarthShadow(sample.eci, time)
  );
}

function isVisibleDuring(sky: SkyAt, observer: ObserverSite, bounds: PassWindow, peakMs: number): boolean {
  const steps = Math.floor((bounds.losMs - bounds.aosMs) / VISIBILITY_SAMPLE_MS);
  const times = [
    ...Array.from({ length: steps + 1 }, (_, i) => bounds.aosMs + i * VISIBILITY_SAMPLE_MS),
    peakMs,
    bounds.losMs,
  ];
  return times.some((ms) => {
    const sample = sky(ms);
    return sample !== null && isVisibleMoment(sample, observer);
  });
}

function classify(visible: boolean, maxElevationDeg: number): Pass['quality'] {
  if (!visible) return 'poor';
  if (maxElevationDeg >= 50) return 'excellent';
  if (maxElevationDeg >= 25) return 'good';
  return 'fair';
}

function buildPass(sky: SkyAt, observer: ObserverSite, bounds: PassWindow): Pass | null {
  const peakMs = Math.round(
    maximise((ms) => sky(ms)?.point.elevationDeg ?? BELOW_HORIZON_DEG, bounds.aosMs, bounds.losMs, PEAK_TOLERANCE_MS),
  );
  const start = sky(bounds.aosMs)?.point;
  const peak = sky(peakMs)?.point;
  const end = sky(bounds.losMs)?.point;
  if (!start || !peak || !end) return null;

  const visible = isVisibleDuring(sky, observer, bounds, peakMs);
  return {
    id: `iss-pass-${Math.round(bounds.aosMs / 60_000)}`,
    start,
    peak,
    end,
    durationSeconds: (bounds.losMs - bounds.aosMs) / 1000,
    maxElevationDeg: peak.elevationDeg,
    inProgress: bounds.inProgress,
    visible,
    quality: classify(visible, peak.elevationDeg),
  };
}

/** Upcoming passes above `minElevationDeg`, soonest first. */
export function findPasses(
  satrec: SatRec,
  observer: ObserverSite,
  from: Date,
  options: FindPassesOptions = {},
): Pass[] {
  const { days = 3, minElevationDeg = 10, stepSeconds = 30, maxPasses = 12 } = options;
  if (!(stepSeconds > 0)) throw new RangeError(`stepSeconds must be positive, received ${stepSeconds}`);
  if (!(days > 0)) throw new RangeError(`days must be positive, received ${days}`);

  const sky: SkyAt = (ms) => skyAt(satrec, observer, ms);
  const isUp = (ms: number): boolean => (sky(ms)?.point.elevationDeg ?? BELOW_HORIZON_DEG) >= minElevationDeg;
  const windows = scanWindows(isUp, from.getTime(), days * MS_PER_DAY, stepSeconds * 1000, maxPasses);
  return windows.flatMap((bounds) => buildPass(sky, observer, bounds) ?? []);
}
