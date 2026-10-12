import { describe, expect, it } from 'vitest';

import { normaliseTelemetry } from '@/lib/api/iss-telemetry';

// Captured from https://api.wheretheiss.at/v1/satellites/25544
const PAYLOAD = {
  name: 'iss',
  id: 25544,
  latitude: 42.554580868282,
  longitude: -154.71165959091,
  altitude: 427.03811684414,
  velocity: 27572.590061586,
  visibility: 'daylight',
  footprint: 4543.0983051691,
  timestamp: 1791760805,
  daynum: 2461325.4722801,
  solar_lat: -7.3084275458169,
  solar_lon: 186.62946460132,
  units: 'kilometers',
};

describe('normaliseTelemetry', () => {
  it('converts km/h to km/s', () => {
    const telemetry = normaliseTelemetry(PAYLOAD);
    expect(telemetry.speedKps).toBeCloseTo(27572.590061586 / 3600, 10);
    expect(telemetry.speedKps).toBeGreaterThan(7.5);
    expect(telemetry.speedKps).toBeLessThan(7.8);
  });

  it('normalises solar_lon from 0..360 into [-180, 180)', () => {
    const { solar } = normaliseTelemetry(PAYLOAD);
    expect(solar.latitude).toBe(-7.3084275458169);
    expect(solar.longitude).toBeCloseTo(186.62946460132 - 360, 10);
    const at = (solar_lon: number) => normaliseTelemetry({ ...PAYLOAD, solar_lon }).solar.longitude;
    expect(at(0)).toBe(0);
    expect(at(179.5)).toBe(179.5);
    expect(at(180)).toBe(-180);
    expect(at(359.5)).toBeCloseTo(-0.5, 10);
    expect(at(360)).toBe(0);
  });

  it('maps the remaining fields and turns the unix timestamp into a Date', () => {
    const telemetry = normaliseTelemetry(PAYLOAD);
    expect(telemetry.time).toEqual(new Date(1791760805 * 1000));
    expect(telemetry).toMatchObject({
      latitude: 42.554580868282,
      longitude: -154.71165959091,
      altitudeKm: 427.03811684414,
      footprintKm: 4543.0983051691,
      visibility: 'daylight',
    });
  });

  it('keeps eclipsed and treats the API\'s "visible" as sunlit', () => {
    expect(normaliseTelemetry({ ...PAYLOAD, visibility: 'eclipsed' }).visibility).toBe('eclipsed');
    expect(normaliseTelemetry({ ...PAYLOAD, visibility: 'visible' }).visibility).toBe('daylight');
  });

  it('wraps an out-of-range longitude', () => {
    expect(normaliseTelemetry({ ...PAYLOAD, longitude: 190 }).longitude).toBe(-170);
  });

  it('names the offending field when the payload is invalid', () => {
    // An undefined field fails zod's "required" check exactly like a missing key.
    const withoutVelocity = { ...PAYLOAD, velocity: undefined };
    expect(() => normaliseTelemetry(withoutVelocity)).toThrow(
      /Invalid ISS telemetry payload: velocity/,
    );
    expect(() => normaliseTelemetry({ ...PAYLOAD, latitude: 120 })).toThrow(/latitude/);
    expect(() => normaliseTelemetry({ ...PAYLOAD, visibility: 'dusk' })).toThrow(/visibility/);
  });

  it('refuses a payload that is not in kilometres', () => {
    expect(() => normaliseTelemetry({ ...PAYLOAD, units: 'miles' })).toThrow(/units/);
  });

  it('rejects non-object payloads', () => {
    expect(() => normaliseTelemetry(null)).toThrow(/Invalid ISS telemetry payload/);
    expect(() => normaliseTelemetry('oops')).toThrow(/Invalid ISS telemetry payload/);
  });
});
