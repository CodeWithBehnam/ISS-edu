import { describe, expect, it } from 'vitest';
import { altitudeToSceneRadius, geodeticToScene, type Tuple3 } from '@/lib/orbit/frames';
import {
  createSatrec,
  orbitalPeriodMinutes,
  propagateState,
  revolutionNumberAt,
  sampleOrbit,
  sceneTrackDirection,
  tleEpoch,
} from '@/lib/orbit/satrec';

// Real ISS element set, epoch 2026-10-11 04:14 UTC (valid checksums).
const LINE1 = '1 25544U 98067A   26284.17638745  .00009430  00000+0  18014-3 0  9995';
const LINE2 = '2 25544  51.6312  86.0933 0006713 248.1316 111.8959 15.48821882589734';

const MS_PER_MINUTE = 60_000;
const satrec = createSatrec({ line1: LINE1, line2: LINE2 });
const epoch = tleEpoch(satrec);
const periodMs = orbitalPeriodMinutes(satrec) * MS_PER_MINUTE;

const at = (offsetMs: number): Date => new Date(epoch.getTime() + offsetMs);
const dot = (a: Tuple3, b: Tuple3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (v: Tuple3): number => Math.hypot(v[0], v[1], v[2]);

describe('createSatrec', () => {
  it('parses a valid element set', () => {
    expect(satrec.satnum).toBe('25544');
    expect(satrec.error).toBe(0);
  });

  it('throws on garbage lines instead of returning a NaN record', () => {
    expect(() => createSatrec({ line1: 'garbage', line2: 'rubbish' })).toThrow(Error);
  });

  it('throws on empty lines', () => {
    expect(() => createSatrec({ line1: '', line2: '' })).toThrow(Error);
  });

  it('throws when the mean motion field is unreadable', () => {
    const blankMotion = `${LINE2.slice(0, 52)}           ${LINE2.slice(63)}`;
    expect(() => createSatrec({ line1: LINE1, line2: blankMotion })).toThrow(Error);
  });
});

describe('tleEpoch', () => {
  it('converts the Julian date epoch to a UTC Date', () => {
    const expected = Date.UTC(2026, 9, 11, 4, 14, 0);
    expect(Math.abs(epoch.getTime() - expected)).toBeLessThan(1000);
  });
});

describe('orbitalPeriodMinutes', () => {
  it('is about 92.97 minutes for the ISS', () => {
    expect(orbitalPeriodMinutes(satrec)).toBeCloseTo(92.97, 1);
    expect(Math.abs(orbitalPeriodMinutes(satrec) - 92.97)).toBeLessThan(0.05);
  });
});

describe('propagateState', () => {
  it('returns a plausible state at the epoch', () => {
    const state = propagateState(satrec, epoch);
    expect(state).not.toBeNull();
    if (state === null) return;
    expect(state.time.getTime()).toBe(epoch.getTime());
    expect(state.time).not.toBe(epoch);
    expect(state.longitude).toBeGreaterThanOrEqual(-180);
    expect(state.longitude).toBeLessThan(180);
    expect(Math.hypot(state.eci.x, state.eci.y, state.eci.z)).toBeGreaterThan(6700);
    expect(state.speedKps).toBeCloseTo(
      Math.hypot(state.eciVelocity.x, state.eciVelocity.y, state.eciVelocity.z),
      9,
    );
  });

  it('stays within the ISS envelope for 24 hours', () => {
    const samples = sampleOrbit(satrec, epoch, at(24 * 60 * MS_PER_MINUTE), 60);
    expect(samples).toHaveLength(1441);

    // Geodetic latitude peaks about 0.17 degrees above the 51.63 degree inclination because
    // the ellipsoid is flattened, so allow 0.25 degrees rather than the bare inclination.
    const latitudeLimit = (satrec.inclo * 180) / Math.PI + 0.25;
    for (const state of samples) {
      expect(state.altitudeKm).toBeGreaterThan(400);
      expect(state.altitudeKm).toBeLessThan(440);
      expect(state.speedKps).toBeGreaterThan(7.6);
      expect(state.speedKps).toBeLessThan(7.75);
      expect(Math.abs(state.latitude)).toBeLessThanOrEqual(latitudeLimit);
      expect(state.longitude).toBeGreaterThanOrEqual(-180);
      expect(state.longitude).toBeLessThan(180);
    }
    const peak = Math.max(...samples.map((state) => Math.abs(state.latitude)));
    expect(peak).toBeGreaterThan(51.5);
  });

  it('returns null instead of throwing for an invalid date', () => {
    expect(propagateState(satrec, new Date(Number.NaN))).toBeNull();
  });

  it('returns null once the orbit has decayed', () => {
    expect(propagateState(satrec, at(3650 * 86_400_000))).toBeNull();
    expect(propagateState(satrec, at(10_000 * 86_400_000))).toBeNull();
  });

  it('is repeatable after a failed propagation', () => {
    const before = propagateState(satrec, epoch);
    propagateState(satrec, at(3650 * 86_400_000));
    const after = propagateState(satrec, epoch);
    expect(after).toEqual(before);
  });
});

describe('revolutionNumberAt', () => {
  it('returns the TLE revolution number at the epoch', () => {
    expect(revolutionNumberAt(satrec, LINE2, epoch)).toBe(58973);
  });

  it('adds one after a full period', () => {
    expect(revolutionNumberAt(satrec, LINE2, at(periodMs + 1000))).toBe(58974);
    expect(revolutionNumberAt(satrec, LINE2, at(periodMs - 1000))).toBe(58973);
    expect(revolutionNumberAt(satrec, LINE2, at(5 * periodMs + 1000))).toBe(58978);
  });

  it('counts back before the epoch', () => {
    expect(revolutionNumberAt(satrec, LINE2, at(-1000))).toBe(58972);
  });

  it('rejects a line 2 without a revolution number', () => {
    const blankRevolution = `${LINE2.slice(0, 63)}     ${LINE2.slice(68)}`;
    expect(() => revolutionNumberAt(satrec, blankRevolution, epoch)).toThrow(Error);
  });
});

describe('sampleOrbit', () => {
  it('returns evenly spaced, ordered samples including both ends when aligned', () => {
    const samples = sampleOrbit(satrec, epoch, at(600_000), 20);
    expect(samples).toHaveLength(31);
    expect(samples[0]?.time.getTime()).toBe(epoch.getTime());
    expect(samples[30]?.time.getTime()).toBe(at(600_000).getTime());
    samples.slice(1).forEach((state, index) => {
      const previous = samples[index];
      expect(state.time.getTime() - (previous?.time.getTime() ?? 0)).toBe(20_000);
    });
  });

  it('stops at the last step that does not pass the end', () => {
    const samples = sampleOrbit(satrec, epoch, at(65_000), 20);
    expect(samples).toHaveLength(4);
    expect(samples[3]?.time.getTime()).toBe(at(60_000).getTime());
  });

  it('covers one period at the 20 s step used for the orbit lines', () => {
    const samples = sampleOrbit(satrec, epoch, at(periodMs), 20);
    expect(samples).toHaveLength(Math.floor(periodMs / 20_000) + 1);
  });

  it('returns a single sample when the span is shorter than a step', () => {
    expect(sampleOrbit(satrec, epoch, at(5_000), 20)).toHaveLength(1);
    expect(sampleOrbit(satrec, epoch, epoch, 20)).toHaveLength(1);
  });

  it('returns nothing when end precedes start or a date is invalid', () => {
    expect(sampleOrbit(satrec, at(1000), epoch, 20)).toEqual([]);
    expect(sampleOrbit(satrec, epoch, new Date(Number.NaN), 20)).toEqual([]);
  });

  it('rejects a non-positive or non-finite step', () => {
    expect(() => sampleOrbit(satrec, epoch, at(1000), 0)).toThrow(RangeError);
    expect(() => sampleOrbit(satrec, epoch, at(1000), -5)).toThrow(RangeError);
    expect(() => sampleOrbit(satrec, epoch, at(1000), Number.NaN)).toThrow(RangeError);
  });

  it('skips samples that SGP4 rejects', () => {
    // Long after the epoch the propagator intermittently reports a decayed orbit, so a window of
    // consecutive orbits holds both good and rejected samples.
    const start = at(2131.3 * 86_400_000);
    const end = at(2131.5 * 86_400_000);
    const nominal = Math.floor((end.getTime() - start.getTime()) / 60_000) + 1;
    const samples = sampleOrbit(satrec, start, end, 60);
    expect(samples.length).toBeGreaterThan(0);
    expect(samples.length).toBeLessThan(nominal);

    const times = samples.map((state) => state.time.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('returns nothing when every sample fails', () => {
    const start = at(3650 * 86_400_000);
    expect(sampleOrbit(satrec, start, new Date(start.getTime() + 3_600_000), 60)).toEqual([]);
  });
});

describe('sceneTrackDirection', () => {
  it('is a unit vector perpendicular to the radial direction', () => {
    for (const offsetMin of [0, 10, 25, 47, 70, 91, 600, 1234]) {
      const time = at(offsetMin * MS_PER_MINUTE);
      const direction = sceneTrackDirection(satrec, time);
      expect(direction).not.toBeNull();
      if (direction === null) continue;
      expect(length(direction)).toBeCloseTo(1, 12);

      const state = propagateState(satrec, time);
      if (state === null) throw new Error('expected a propagated state');
      const radial = geodeticToScene(
        state.latitude,
        state.longitude,
        altitudeToSceneRadius(state.altitudeKm),
      );
      const cosine = dot(direction, radial) / length(radial);
      // The only radial component comes from the tiny eccentricity-driven altitude change.
      expect(Math.abs(cosine)).toBeLessThan(0.02);
    }
  });

  it('points along the ground track at the next sample', () => {
    const time = at(12 * MS_PER_MINUTE);
    const direction = sceneTrackDirection(satrec, time);
    const now = propagateState(satrec, time);
    const later = propagateState(satrec, new Date(time.getTime() + 5000));
    if (direction === null || now === null || later === null) throw new Error('expected states');

    const from = geodeticToScene(now.latitude, now.longitude, altitudeToSceneRadius(now.altitudeKm));
    const to = geodeticToScene(
      later.latitude,
      later.longitude,
      altitudeToSceneRadius(later.altitudeKm),
    );
    const chord: Tuple3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    expect(dot(direction, chord) / length(chord)).toBeGreaterThan(0.999);
  });

  it('heads north on ascending passes and south on descending ones', () => {
    const headings = Array.from({ length: 93 }, (_, minute) => {
      const time = at(minute * MS_PER_MINUTE);
      const direction = sceneTrackDirection(satrec, time);
      const now = propagateState(satrec, time);
      const later = propagateState(satrec, new Date(time.getTime() + 10_000));
      if (direction === null || now === null || later === null) throw new Error('expected states');
      // Scene +Y is north, so the Y component must agree with the latitude trend.
      return { northward: direction[1] > 0, latitudeRising: later.latitude > now.latitude };
    });
    expect(headings.every((h) => h.northward === h.latitudeRising)).toBe(true);
    expect(headings.filter((h) => h.northward).length).toBeGreaterThan(30);
    expect(headings.filter((h) => !h.northward).length).toBeGreaterThan(30);
  });

  it('returns null when the orbit cannot be propagated', () => {
    expect(sceneTrackDirection(satrec, at(3650 * 86_400_000))).toBeNull();
    expect(sceneTrackDirection(satrec, new Date(Number.NaN))).toBeNull();
  });

  it('rejects a non-positive step', () => {
    expect(() => sceneTrackDirection(satrec, epoch, 0)).toThrow(RangeError);
    expect(() => sceneTrackDirection(satrec, epoch, -1)).toThrow(RangeError);
  });
});
