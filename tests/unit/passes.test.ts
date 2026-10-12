import { describe, expect, it } from 'vitest';
import { propagate, twoline2satrec } from 'satellite.js';
import { isInEarthShadow, sunElevationDeg } from '@/lib/astro/sun';
import { findPasses, lookAnglesAt, type ObserverSite, type Pass } from '@/lib/orbit/passes';

const LINE1 = '1 25544U 98067A   26284.17638745  .00009430  00000+0  18014-3 0  9995';
const LINE2 = '2 25544  51.6312  86.0933 0006713 248.1316 111.8959 15.48821882589734';
const satrec = twoline2satrec(LINE1, LINE2);
const EPOCH = new Date(Date.UTC(2026, 0, 1) + (284.17638745 - 1) * 86_400_000);
const LONDON: ObserverSite = { latitude: 51.5074, longitude: -0.1278 };
const DAY_MS = 86_400_000;

const at = (ms: number): Date => new Date(ms);

/** Sampled elevations every `stepMs` over [startMs, endMs], by direct SGP4 and look angles. */
function elevations(observer: ObserverSite, startMs: number, endMs: number, stepMs: number): number[] {
  const count = Math.floor((endMs - startMs) / stepMs) + 1;
  return Array.from({ length: count }, (_, i) => lookAnglesAt(satrec, observer, at(startMs + i * stepMs))?.elevationDeg ?? -90);
}

function bruteForceVisible(observer: ObserverSite, pass: Pass): boolean {
  const startMs = pass.start.time.getTime();
  const endMs = pass.end.time.getTime();
  for (let ms = startMs; ms <= endMs; ms += 2000) {
    const time = at(ms);
    const point = lookAnglesAt(satrec, observer, time);
    const { position } = propagate(satrec, time);
    if (!point || typeof position === 'boolean') continue;
    if (point.elevationDeg >= 10 && sunElevationDeg(observer, time) < -6 && !isInEarthShadow(position, time)) return true;
  }
  return false;
}

describe('lookAnglesAt', () => {
  it('returns finite angles with azimuth in [0, 360)', () => {
    const point = lookAnglesAt(satrec, LONDON, EPOCH);
    expect(point).not.toBeNull();
    if (!point) return;
    expect(Number.isFinite(point.elevationDeg)).toBe(true);
    expect(point.azimuthDeg).toBeGreaterThanOrEqual(0);
    expect(point.azimuthDeg).toBeLessThan(360);
    expect(point.rangeKm).toBeGreaterThan(400);
    expect(point.time.getTime()).toBe(EPOCH.getTime());
  });

  it('puts the station within a few hundred kilometres overhead at a 90° pass', () => {
    const overhead = findPasses(satrec, LONDON, EPOCH, { days: 3, maxPasses: 100 }).find((p) => p.maxElevationDeg > 85);
    expect(overhead).toBeDefined();
    if (!overhead) return;
    const point = lookAnglesAt(satrec, LONDON, overhead.peak.time);
    expect(point?.rangeKm).toBeLessThan(450);
  });
});

describe('findPasses for London over three days', () => {
  const passes = findPasses(satrec, LONDON, EPOCH, { days: 3, maxPasses: 100 });

  it('finds several passes in time order with unique ids', () => {
    expect(passes.length).toBeGreaterThanOrEqual(3);
    passes.forEach((pass, i) => {
      if (i > 0) expect(pass.start.time.getTime()).toBeGreaterThan(passes[i - 1].end.time.getTime());
    });
    expect(new Set(passes.map((p) => p.id)).size).toBe(passes.length);
  });

  it('has consistent geometry for every pass', () => {
    for (const pass of passes) {
      expect(pass.start.time.getTime()).toBeLessThan(pass.peak.time.getTime());
      expect(pass.peak.time.getTime()).toBeLessThan(pass.end.time.getTime());
      expect(pass.durationSeconds).toBeGreaterThanOrEqual(60);
      expect(pass.durationSeconds).toBeLessThanOrEqual(900);
      expect(pass.durationSeconds).toBeCloseTo((pass.end.time.getTime() - pass.start.time.getTime()) / 1000, 6);
      expect(pass.maxElevationDeg).toBeGreaterThanOrEqual(10);
      expect(pass.maxElevationDeg).toBeLessThanOrEqual(90);
      expect(pass.maxElevationDeg).toBe(pass.peak.elevationDeg);
      expect(Math.abs(pass.start.elevationDeg - 10)).toBeLessThan(0.5);
      expect(Math.abs(pass.end.elevationDeg - 10)).toBeLessThan(0.5);
      expect(pass.start.elevationDeg).toBeGreaterThanOrEqual(10 - 1e-9);
      expect(pass.end.elevationDeg).toBeGreaterThanOrEqual(10 - 1e-9);
    }
  });

  it('matches a brute-force one second scan for the peak', () => {
    for (const pass of passes) {
      const scan = elevations(LONDON, pass.start.time.getTime(), pass.end.time.getTime(), 1000);
      expect(Math.abs(Math.max(...scan) - pass.maxElevationDeg)).toBeLessThan(0.2);
    }
  });

  it('misses no pass that a brute-force scan finds', () => {
    const startMs = EPOCH.getTime();
    const scan = elevations(LONDON, startMs, startMs + 3 * DAY_MS, 1000);
    const risings = scan.filter((el, i) => i > 0 && scan[i - 1] < 10 && el >= 10).length;
    expect(passes.length).toBe(risings);
  });

  it('reports no pass in progress at the epoch unless the station is already up', () => {
    const startElevation = lookAnglesAt(satrec, LONDON, EPOCH)?.elevationDeg ?? -90;
    expect(passes[0].inProgress).toBe(startElevation >= 10);
    expect(passes.slice(1).every((p) => !p.inProgress)).toBe(true);
  });

  it('grades quality from visibility and peak elevation', () => {
    for (const pass of passes) {
      if (!pass.visible) expect(pass.quality).toBe('poor');
      else if (pass.maxElevationDeg >= 50) expect(pass.quality).toBe('excellent');
      else if (pass.maxElevationDeg >= 25) expect(pass.quality).toBe('good');
      else expect(pass.quality).toBe('fair');
    }
  });
});

describe('visibility', () => {
  const fortnight = findPasses(satrec, LONDON, EPOCH, { days: 14, maxPasses: 400 });

  it('finds some visible passes and many that are not', () => {
    expect(fortnight.some((p) => p.visible)).toBe(true);
    expect(fortnight.some((p) => !p.visible)).toBe(true);
    expect(new Set(fortnight.filter((p) => p.visible).map((p) => p.quality)).size).toBeGreaterThan(1);
  });

  it('agrees with an independent two second scan of the same conditions', () => {
    for (const pass of fortnight) expect(pass.visible, pass.id).toBe(bruteForceVisible(LONDON, pass));
  });
});

describe('findPasses options and edge cases', () => {
  it('returns no passes for an observer the orbit never reaches', () => {
    expect(findPasses(satrec, { latitude: -80, longitude: 0 }, EPOCH)).toEqual([]);
    expect(findPasses(satrec, { latitude: 80, longitude: 0 }, EPOCH)).toEqual([]);
  });

  it('honours maxPasses', () => {
    expect(findPasses(satrec, LONDON, EPOCH, { maxPasses: 2 })).toHaveLength(2);
    expect(findPasses(satrec, LONDON, EPOCH, { maxPasses: 0 })).toEqual([]);
    expect(findPasses(satrec, LONDON, EPOCH).length).toBeLessThanOrEqual(12);
  });

  it('honours the minimum elevation', () => {
    const high = findPasses(satrec, LONDON, EPOCH, { minElevationDeg: 30, maxPasses: 100 });
    const normal = findPasses(satrec, LONDON, EPOCH, { maxPasses: 100 });
    expect(high.length).toBeGreaterThan(0);
    expect(high.length).toBeLessThan(normal.length);
    for (const pass of high) {
      expect(pass.maxElevationDeg).toBeGreaterThanOrEqual(30);
      expect(Math.abs(pass.start.elevationDeg - 30)).toBeLessThan(0.5);
    }
  });

  it('honours the search window length', () => {
    const day = findPasses(satrec, LONDON, EPOCH, { days: 1, maxPasses: 100 });
    expect(day.length).toBeGreaterThan(0);
    for (const pass of day) expect(pass.start.time.getTime()).toBeLessThanOrEqual(EPOCH.getTime() + DAY_MS);
  });

  it('flags a pass already under way and reports its true rise', () => {
    const [first] = findPasses(satrec, LONDON, EPOCH, { maxPasses: 1 });
    const midPass = findPasses(satrec, LONDON, first.peak.time, { days: 1, maxPasses: 2 });
    expect(midPass[0].inProgress).toBe(true);
    expect(Math.abs(midPass[0].start.time.getTime() - first.start.time.getTime())).toBeLessThan(1000);
    expect(Math.abs(midPass[0].end.time.getTime() - first.end.time.getTime())).toBeLessThan(1000);
    expect(Math.abs(midPass[0].maxElevationDeg - first.maxElevationDeg)).toBeLessThan(0.2);
    expect(midPass[0].start.time.getTime()).toBeLessThan(first.peak.time.getTime());
    expect(midPass[1].inProgress).toBe(false);
  });

  it('follows a pass that is still running at the end of the window', () => {
    const [first] = findPasses(satrec, LONDON, EPOCH, { maxPasses: 1 });
    const spanDays = (first.peak.time.getTime() - EPOCH.getTime()) / DAY_MS;
    const [clipped] = findPasses(satrec, LONDON, EPOCH, { days: spanDays });
    expect(clipped.end.time.getTime()).toBe(first.end.time.getTime());
  });

  it('keeps ids stable when the search starts later', () => {
    const early = findPasses(satrec, LONDON, EPOCH, { days: 2, maxPasses: 100 });
    const later = findPasses(satrec, LONDON, at(EPOCH.getTime() + 10 * 60_000), { days: 2, maxPasses: 100 });
    const earlyIds = new Set(early.map((p) => p.id));
    const overlapping = later.filter((p) => p.start.time.getTime() < EPOCH.getTime() + 2 * DAY_MS);
    expect(overlapping.length).toBeGreaterThan(5);
    expect(overlapping.every((p) => earlyIds.has(p.id))).toBe(true);
  });

  it('rejects non-positive scan parameters', () => {
    expect(() => findPasses(satrec, LONDON, EPOCH, { stepSeconds: 0 })).toThrow(RangeError);
    expect(() => findPasses(satrec, LONDON, EPOCH, { days: 0 })).toThrow(RangeError);
  });

  it('computes ten days of passes quickly enough for the UI thread', () => {
    const started = performance.now();
    findPasses(satrec, LONDON, EPOCH, { days: 10, maxPasses: 100 });
    expect(performance.now() - started).toBeLessThan(500);
  });
});
