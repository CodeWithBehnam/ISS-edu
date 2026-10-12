import { describe, expect, it } from 'vitest';

import { createIssFrame } from '@/components/scene/iss-frame';
import { sunReferenceTime, writeSunDirection } from '@/components/scene/sun-frame';
import type { LiveTelemetry } from '@/lib/api/iss-telemetry';
import { subsolarPoint } from '@/lib/astro/sun';
import { sceneToGeodetic } from '@/lib/orbit/frames';

const MORNING = new Date('2026-10-12T07:00:00Z');
const AFTERNOON = new Date('2026-10-12T13:00:00Z');

const FIX: LiveTelemetry = {
  time: new Date('2026-10-12T06:59:55Z'),
  latitude: -28.55,
  longitude: -61.48,
  altitudeKm: 420,
  speedKps: 7.66,
  visibility: 'eclipsed',
  footprintKm: 4500,
  solar: { latitude: -7.4, longitude: 84.9 },
};

describe('writeSunDirection', () => {
  it('lights the globe from the subsolar point, not the placeholder at latitude 0, longitude 0', () => {
    const frame = createIssFrame();
    expect(frame.sunDir.toArray()).toEqual([1, 0, 0]);

    writeSunDirection(frame, MORNING);

    const lit = sceneToGeodetic([frame.sunDir.x, frame.sunDir.y, frame.sunDir.z]);
    const expected = subsolarPoint(MORNING);
    expect(lit.latitude).toBeCloseTo(expected.latitude, 6);
    expect(lit.longitude).toBeCloseTo(expected.longitude, 6);
    expect(Math.abs(lit.longitude)).toBeGreaterThan(60);
    expect(frame.sunDir.length()).toBeCloseTo(1, 9);
  });

  it('moves the Sun westwards at 15 degrees an hour, whatever the orbit data', () => {
    const frame = createIssFrame();
    writeSunDirection(frame, MORNING);
    const before = sceneToGeodetic([frame.sunDir.x, frame.sunDir.y, frame.sunDir.z]);
    writeSunDirection(frame, AFTERNOON);
    const after = sceneToGeodetic([frame.sunDir.x, frame.sunDir.y, frame.sunDir.z]);
    expect(before.longitude - after.longitude).toBeCloseTo(90, 0);
  });
});

describe('sunReferenceTime', () => {
  it('follows the sim clock when an orbit model drives the station', () => {
    expect(sunReferenceTime(AFTERNOON, true, FIX)).toBe(AFTERNOON);
    expect(sunReferenceTime(AFTERNOON, true, null)).toBe(AFTERNOON);
  });

  it('stays on the live fix when only telemetry is available, so scrubbing cannot split Sun and ISS', () => {
    expect(sunReferenceTime(AFTERNOON, false, FIX)).toBe(FIX.time);
  });

  it('uses the sim clock while nothing has loaded yet', () => {
    expect(sunReferenceTime(MORNING, false, null)).toBe(MORNING);
  });
});
