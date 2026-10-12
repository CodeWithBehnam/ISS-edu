import { describe, expect, it } from 'vitest';
import { propagate, twoline2satrec } from 'satellite.js';
import {
  type ShadowTransition,
  isInEarthShadow,
  nextShadowTransition,
  subsolarPoint,
  sunDirectionEci,
  sunDirectionEcf,
  sunElevationDeg,
} from '@/lib/astro/sun';
import { normaliseLongitude } from '@/lib/orbit/frames';
import type { Vec3 } from '@/lib/orbit/types';

const LINE1 = '1 25544U 98067A   26284.17638745  .00009430  00000+0  18014-3 0  9995';
const LINE2 = '2 25544  51.6312  86.0933 0006713 248.1316 111.8959 15.48821882589734';
const satrec = twoline2satrec(LINE1, LINE2);
// TLE epoch is 2026 day 284.17638745 (Jan 1 = day 1.0).
const EPOCH = new Date(Date.UTC(2026, 0, 1) + (284.17638745 - 1) * 86_400_000);
const PERIOD_MS = ((2 * Math.PI) / satrec.no) * 60_000;

const scale = (v: Vec3, k: number): Vec3 => ({ x: v.x * k, y: v.y * k, z: v.z * k });
const norm = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);

function eciAt(time: Date): Vec3 {
  const { position } = propagate(satrec, time);
  if (typeof position === 'boolean') throw new Error(`SGP4 failed at ${time.toISOString()}`);
  return position;
}

const shadowedAt = (time: Date): boolean => isInEarthShadow(eciAt(time), time);

describe('sun direction', () => {
  it('returns unit vectors in both frames', () => {
    for (const iso of ['2000-01-01T12:00:00Z', '2026-03-20T14:46:00Z', '2026-10-11T04:13:00Z', '2040-07-01T00:00:00Z']) {
      const time = new Date(iso);
      expect(norm(sunDirectionEci(time))).toBeCloseTo(1, 12);
      expect(norm(sunDirectionEcf(time))).toBeCloseTo(1, 12);
    }
  });

  it('points towards the vernal equinox at the March equinox', () => {
    const sun = sunDirectionEci(new Date('2026-03-20T14:46:00Z'));
    expect(sun.x).toBeGreaterThan(0.9999);
    expect(Math.abs(sun.z)).toBeLessThan(0.005);
  });
});

describe('subsolarPoint', () => {
  it('reaches +23.44° latitude at the June solstice', () => {
    expect(Math.abs(subsolarPoint(new Date('2026-06-21T08:24:00Z')).latitude - 23.44)).toBeLessThan(0.15);
  });

  it('crosses the equator at the March equinox', () => {
    expect(Math.abs(subsolarPoint(new Date('2026-03-20T14:46:00Z')).latitude)).toBeLessThan(0.3);
  });

  it('reaches -23.44° latitude at the December solstice', () => {
    expect(Math.abs(subsolarPoint(new Date('2026-12-21T20:50:00Z')).latitude + 23.44)).toBeLessThan(0.15);
  });

  it('agrees with the live wheretheiss.at sample', () => {
    // solar_lat -7.3059, solar_lon 189.0424 (0..360) at unix 1791760226.
    const point = subsolarPoint(new Date(1791760226 * 1000));
    expect(Math.abs(point.latitude - -7.3059)).toBeLessThan(0.1);
    expect(Math.abs(point.longitude - normaliseLongitude(189.0424))).toBeLessThan(0.5);
  });

  it('moves west by 15° per hour', () => {
    const a = subsolarPoint(new Date('2026-10-11T10:00:00Z'));
    const b = subsolarPoint(new Date('2026-10-11T11:00:00Z'));
    expect(normaliseLongitude(a.longitude - b.longitude)).toBeCloseTo(15, 0);
  });

  it('keeps longitude within [-180, 180)', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const { longitude } = subsolarPoint(new Date(Date.UTC(2026, 9, 11, hour)));
      expect(longitude).toBeGreaterThanOrEqual(-180);
      expect(longitude).toBeLessThan(180);
    }
  });
});

describe('sunElevationDeg', () => {
  const time = new Date('2026-10-11T10:00:00Z');

  it('is 90° at the subsolar point', () => {
    expect(sunElevationDeg(subsolarPoint(time), time)).toBeCloseTo(90, 3);
  });

  it('is -90° at the antipode', () => {
    const { latitude, longitude } = subsolarPoint(time);
    const antipode = { latitude: -latitude, longitude: normaliseLongitude(longitude + 180) };
    expect(sunElevationDeg(antipode, time)).toBeCloseTo(-90, 3);
  });

  it('matches the textbook noon elevation for London at the June solstice', () => {
    const noon = new Date('2026-06-21T12:00:00Z');
    const expected = 90 - 51.5074 + 23.44;
    expect(Math.abs(sunElevationDeg({ latitude: 51.5074, longitude: -0.1278 }, noon) - expected)).toBeLessThan(0.7);
  });

  it('is negative at midnight in London', () => {
    expect(sunElevationDeg({ latitude: 51.5074, longitude: -0.1278 }, new Date('2026-12-21T00:00:00Z'))).toBeLessThan(-50);
  });
});

describe('isInEarthShadow', () => {
  const time = new Date('2026-10-11T04:13:00Z');
  const sun = sunDirectionEci(time);
  // Any unit vector perpendicular to the Sun direction.
  const sideways = scale({ x: -sun.y, y: sun.x, z: 0 }, 1 / Math.hypot(sun.x, sun.y));

  it('is dark 7000 km on the anti-sun side and lit on the sun side', () => {
    expect(isInEarthShadow(scale(sun, -7000), time)).toBe(true);
    expect(isInEarthShadow(scale(sun, 7000), time)).toBe(false);
  });

  it('is lit beside the Earth, outside the cylinder', () => {
    expect(isInEarthShadow(scale(sideways, 7000), time)).toBe(false);
  });

  it('follows the 6378.137 km cylinder radius behind the Earth', () => {
    const behind = (offsetKm: number): Vec3 => ({
      x: -7000 * sun.x + offsetKm * sideways.x,
      y: -7000 * sun.y + offsetKm * sideways.y,
      z: -7000 * sun.z + offsetKm * sideways.z,
    });
    expect(isInEarthShadow(behind(6300), time)).toBe(true);
    expect(isInEarthShadow(behind(6450), time)).toBe(false);
  });

  it('puts the ISS in shadow for roughly the share the orbit geometry predicts', () => {
    const samples = Array.from({ length: 24 * 60 }, (_, minute) => new Date(EPOCH.getTime() + minute * 60_000));
    const fraction = samples.filter(shadowedAt).length / samples.length;

    // Eclipse arc of a circular orbit from its beta angle (angle between orbit plane and the Sun).
    const mid = samples[samples.length / 2];
    const { position, velocity } = propagate(satrec, mid);
    if (typeof position === 'boolean' || typeof velocity === 'boolean') throw new Error('SGP4 failed');
    const normal = {
      x: position.y * velocity.z - position.z * velocity.y,
      y: position.z * velocity.x - position.x * velocity.z,
      z: position.x * velocity.y - position.y * velocity.x,
    };
    const sunMid = sunDirectionEci(mid);
    const beta = Math.asin((normal.x * sunMid.x + normal.y * sunMid.y + normal.z * sunMid.z) / norm(normal));
    const radius = norm(position);
    const earth = 6378.137;
    const analytic = Math.acos(Math.sqrt(radius * radius - earth * earth) / (radius * Math.cos(beta))) / Math.PI;

    // High beta angles this epoch keep the shadow share near the bottom of the usual 30 to 45 % range.
    expect(fraction).toBeGreaterThan(0.25);
    expect(fraction).toBeLessThan(0.45);
    expect(Math.abs(fraction - analytic)).toBeLessThan(0.02);
  });
});

describe('nextShadowTransition', () => {
  it('alternates kinds, each within one orbital period of the last', () => {
    const transitions: ShadowTransition[] = [];
    let cursor = EPOCH;
    for (let i = 0; i < 6; i += 1) {
      const next = nextShadowTransition(satrec, cursor);
      expect(next).not.toBeNull();
      if (!next) return;
      transitions.push(next);
      cursor = next.at;
    }
    transitions.forEach((transition, i) => {
      if (i === 0) return;
      expect(transition.kind).not.toBe(transitions[i - 1].kind);
      const gap = transition.at.getTime() - transitions[i - 1].at.getTime();
      expect(gap).toBeGreaterThan(0);
      expect(gap).toBeLessThan(PERIOD_MS);
    });
  });

  it('is refined to one second', () => {
    const next = nextShadowTransition(satrec, EPOCH);
    expect(next).not.toBeNull();
    if (!next) return;
    const enters = next.kind === 'enter-shadow';
    expect(shadowedAt(next.at)).toBe(enters);
    expect(shadowedAt(new Date(next.at.getTime() - 1000))).toBe(!enters);
  });

  it('reports the change away from the current state first', () => {
    const inShadow = shadowedAt(EPOCH);
    expect(nextShadowTransition(satrec, EPOCH)?.kind).toBe(inShadow ? 'exit-shadow' : 'enter-shadow');
    const beforeEntry = new Date('2026-10-11T04:50:00Z');
    expect(shadowedAt(beforeEntry)).toBe(false);
    expect(nextShadowTransition(satrec, beforeEntry)?.kind).toBe('enter-shadow');
  });

  it('returns null when nothing happens inside the horizon', () => {
    const first = nextShadowTransition(satrec, EPOCH);
    expect(first).not.toBeNull();
    if (!first) return;
    const justAfter = new Date(first.at.getTime() + 60_000);
    expect(nextShadowTransition(satrec, justAfter, 5)).toBeNull();
  });

  it('rejects a non-positive step', () => {
    expect(() => nextShadowTransition(satrec, EPOCH, 120, 0)).toThrow(RangeError);
  });
});
