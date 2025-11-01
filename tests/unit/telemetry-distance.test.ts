import { describe, expect, it } from 'vitest';
import type { IssTelemetry } from '@/lib/types/telemetry';
import { greatCircleDistanceKm } from '@/lib/api/telemetry';

const london: IssTelemetry = {
  timestamp: new Date().toISOString(),
  latitude: 51.5074,
  longitude: -0.1278,
  altitudeKm: 420,
  velocityKps: 7.66,
  visibility: 'night',
  footprintKm: 4500,
  source: 'where-iss-at',
};

const nairobi: IssTelemetry = {
  ...london,
  latitude: -1.2921,
  longitude: 36.8219,
  source: 'nasa-ephemeris',
};

describe('greatCircleDistanceKm', () => {
  it('computes reasonable distance between two coordinates', () => {
    const result = greatCircleDistanceKm(london, nairobi);
    expect(result).toBeGreaterThan(6800);
    expect(result).toBeLessThan(7200);
  });

  it('returns zero for identical coordinates', () => {
    const result = greatCircleDistanceKm(london, london);
    expect(result).toBe(0);
  });
});

