import { describe, expect, it } from 'vitest';

import { describeTimeStatus } from '@/components/hud/time-status';
import type { LiveTelemetry } from '@/lib/api/iss-telemetry';
import { describeDrift, greatCircleKm, pickReading, splitUnit } from '@/lib/format/telemetry';
import { describeTransition, horizonDiameterKm, placeWithArticle } from '@/lib/format/where-now';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  nightPolygon,
  pointsAttribute,
  projectPoint,
  splitAtAntimeridian,
  trackPath,
} from '@/lib/geo/flat-map';
import type { OrbitState } from '@/lib/orbit/types';
import {
  MAX_OFFSET_MINUTES,
  describeOffset,
  formatOffset,
  offsetMinutes,
} from '@/lib/time/offset';

const MINUTE_MS = 60_000;

const STATE: OrbitState = {
  time: new Date('2026-10-12T12:00:00Z'),
  latitude: 10,
  longitude: 20,
  altitudeKm: 420,
  speedKps: 7.66,
  eci: { x: 1, y: 2, z: 3 },
  eciVelocity: { x: 0, y: 0, z: 0 },
  gmst: 0,
};

const TELEMETRY: LiveTelemetry = {
  time: new Date('2026-10-12T12:00:00Z'),
  latitude: -5,
  longitude: 100,
  altitudeKm: 425,
  speedKps: 7.65,
  visibility: 'daylight',
  footprintKm: 4500,
  solar: { latitude: -7, longitude: 170 },
};

describe('time offset labels', () => {
  it('rounds to whole minutes and clamps to the slider range', () => {
    const now = 1_700_000_000_000;
    expect(offsetMinutes(now + 90 * 1000, now)).toBe(2);
    expect(offsetMinutes(now + 20 * 60 * MINUTE_MS, now)).toBe(MAX_OFFSET_MINUTES);
    expect(offsetMinutes(now - 20 * 60 * MINUTE_MS, now)).toBe(-MAX_OFFSET_MINUTES);
  });

  it('formats compact offsets with a real minus sign', () => {
    expect(formatOffset(0)).toBe('Now');
    expect(formatOffset(134)).toBe('+2 h 14 min');
    expect(formatOffset(-45)).toBe('−45 min');
    expect(formatOffset(60)).toBe('+1 h');
  });

  it('speaks offsets with singular and plural units', () => {
    expect(describeOffset(0)).toBe('now');
    expect(describeOffset(61)).toBe('1 hour 1 minute from now');
    expect(describeOffset(-122)).toBe('2 hours 2 minutes ago');
  });
});

describe('describeTimeStatus', () => {
  it('prefers live over paused, then names the rate', () => {
    expect(describeTimeStatus(true, true, 60)).toMatchObject({ label: 'Live', pulse: true });
    expect(describeTimeStatus(false, true, 60)).toMatchObject({ label: 'Paused', pulse: false });
    expect(describeTimeStatus(false, false, 600).label).toBe('Time travel · 600×');
    expect(describeTimeStatus(false, false, 1).label).toBe('Time travel');
  });
});

describe('flat map geometry', () => {
  it('projects the corners of the world onto the map frame', () => {
    expect(projectPoint({ latitude: 90, longitude: -180 })).toEqual([0, 0]);
    expect(projectPoint({ latitude: -90, longitude: 180 })).toEqual([MAP_WIDTH, MAP_HEIGHT]);
  });

  it('splits a track where it wraps round the antimeridian', () => {
    const segments = splitAtAntimeridian([
      { latitude: 0, longitude: 170 },
      { latitude: 1, longitude: 179 },
      { latitude: 2, longitude: -179 },
      { latitude: 3, longitude: -170 },
    ]);
    expect(segments.map((segment) => segment.length)).toEqual([2, 2]);
  });

  it('draws one sub-path per segment and skips single-point segments', () => {
    const path = trackPath([
      { latitude: 0, longitude: 170 },
      { latitude: 1, longitude: 179 },
      { latitude: 2, longitude: -179 },
    ]);
    expect(path.match(/M/g)).toHaveLength(1);
    expect(trackPath([])).toBe('');
  });

  it('closes the night polygon along the winter pole', () => {
    const northernSummer = nightPolygon({ latitude: 20, longitude: 0 });
    expect(northernSummer[0]).toEqual([0, 180]);
    expect(northernSummer[northernSummer.length - 1]).toEqual([MAP_WIDTH, 180]);
    const southernSummer = nightPolygon({ latitude: -20, longitude: 0 });
    expect(southernSummer[0]).toEqual([0, 0]);
  });

  it('stays finite at an exact equinox', () => {
    const points = nightPolygon({ latitude: 0, longitude: 0 });
    expect(points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });

  it('serialises points for an SVG attribute', () => {
    expect(
      pointsAttribute([
        [0, 0],
        [1.26, 2.5],
      ]),
    ).toBe('0,0 1.3,2.5');
  });
});

describe('telemetry readings', () => {
  it('prefers the SGP4 state over the live feed', () => {
    expect(pickReading(STATE, TELEMETRY)).toMatchObject({ source: 'model', latitude: 10 });
    expect(pickReading(null, TELEMETRY)).toMatchObject({ source: 'feed', latitude: -5 });
    expect(pickReading(null, null)).toBeNull();
  });

  it('measures great-circle distance across the antimeridian', () => {
    const quarter = greatCircleKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 90 });
    expect(quarter).toBeCloseTo((Math.PI / 2) * 6371, 0);
    const across = greatCircleKm({ latitude: 0, longitude: 179 }, { latitude: 0, longitude: -179 });
    expect(across).toBeCloseTo((2 * Math.PI * 6371) / 180, 0);
  });

  it('measures a realistic city-to-city distance and zero for the same point', () => {
    const london = { latitude: 51.5074, longitude: -0.1278 };
    const nairobi = { latitude: -1.2921, longitude: 36.8219 };
    const distance = greatCircleKm(london, nairobi);
    expect(distance).toBeGreaterThan(6800);
    expect(distance).toBeLessThan(7200);
    expect(greatCircleKm(london, london)).toBe(0);
  });

  it('splits a formatted value from its unit', () => {
    expect(splitUnit('27,580 km/h')).toEqual({ value: '27,580', unit: 'km/h' });
    expect(splitUnit('n/a')).toEqual({ value: 'n/a', unit: '' });
  });

  it('only warns about old orbit data when the drift is large', () => {
    expect(describeDrift(0.4, 'metric')).toContain('within a kilometre');
    expect(describeDrift(10, 'metric')).toContain('from the live feed');
    expect(describeDrift(10, 'metric')).not.toContain('getting old');
    expect(describeDrift(80, 'metric')).toContain('may be getting old');
  });
});

describe('where-now wording', () => {
  it('adds articles only where English needs them', () => {
    expect(placeWithArticle({ kind: 'ocean', name: 'Pacific Ocean' })).toBe('the Pacific Ocean');
    expect(placeWithArticle({ kind: 'ocean', name: 'Hudson Bay' })).toBe('Hudson Bay');
    expect(placeWithArticle({ kind: 'country', name: 'Brazil', iso2: 'BR', flag: null })).toBe('Brazil');
    expect(placeWithArticle({ kind: 'country', name: 'United Kingdom', iso2: 'GB', flag: null })).toBe(
      'the United Kingdom',
    );
    expect(placeWithArticle({ kind: 'country', name: 'The Bahamas', iso2: 'BS', flag: null })).toBe(
      'the Bahamas',
    );
  });

  it('sizes the visible circle for the station altitude', () => {
    const diameter = horizonDiameterKm(420);
    expect(diameter).toBeGreaterThan(4400);
    expect(diameter).toBeLessThan(4600);
    expect(horizonDiameterKm(0)).toBe(0);
  });

  it('words shadow transitions as a countdown', () => {
    const nowMs = Date.parse('2026-10-12T12:00:00Z');
    const enter = { kind: 'enter-shadow' as const, at: new Date(nowMs + 12 * MINUTE_MS) };
    expect(describeTransition(enter, nowMs)).toBe("Enters Earth's shadow in 12 min");
    const exit = { kind: 'exit-shadow' as const, at: new Date(nowMs + 500) };
    expect(describeTransition(exit, nowMs)).toBe('Sunrise any moment now');
  });
});
