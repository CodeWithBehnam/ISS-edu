import { describe, expect, it } from 'vitest';
import {
  ALTITUDE_EXAGGERATION,
  EARTH_RADIUS_KM,
  EARTH_SCENE_RADIUS,
  altitudeToSceneRadius,
  ecfToScene,
  geodeticToScene,
  normaliseLongitude,
  sceneToGeodetic,
  type Tuple3,
} from '@/lib/orbit/frames';

const DEG = Math.PI / 180;

function expectVector(actual: Tuple3, expected: Tuple3, digits = 12): void {
  expect(actual[0]).toBeCloseTo(expected[0], digits);
  expect(actual[1]).toBeCloseTo(expected[1], digits);
  expect(actual[2]).toBeCloseTo(expected[2], digits);
}

describe('geodeticToScene axis convention', () => {
  it('puts (0, 0) on +X', () => {
    expectVector(geodeticToScene(0, 0, 1), [1, 0, 0]);
  });

  it('puts (0, 90 E) on -Z', () => {
    expectVector(geodeticToScene(0, 90, 1), [0, 0, -1]);
  });

  it('puts (0, 90 W) on +Z and (0, 180) on -X', () => {
    expectVector(geodeticToScene(0, -90, 1), [0, 0, 1]);
    expectVector(geodeticToScene(0, 180, 1), [-1, 0, 0]);
  });

  it('puts the north pole on +Y whatever the longitude', () => {
    for (const longitude of [-180, -120, -45, 0, 33, 90, 179]) {
      expectVector(geodeticToScene(90, longitude, 1), [0, 1, 0]);
    }
  });

  it('puts the south pole on -Y whatever the longitude', () => {
    for (const longitude of [-90, 0, 135]) {
      expectVector(geodeticToScene(-90, longitude, 1), [0, -1, 0]);
    }
  });

  it('scales with the radius', () => {
    expectVector(geodeticToScene(0, 0, 1.23), [1.23, 0, 0]);
    expectVector(geodeticToScene(90, 0, 2), [0, 2, 0]);
  });

  it('puts London east of the prime meridian and north of the equator', () => {
    const [x, y, z] = geodeticToScene(51.5, -0.1, 1);
    expect(x).toBeGreaterThan(0.6);
    expect(y).toBeGreaterThan(0.7);
    // Slightly west of lon 0 means a small positive z (east is -Z).
    expect(z).toBeGreaterThan(0);
    expect(z).toBeLessThan(0.01);
  });
});

describe('sceneToGeodetic', () => {
  it('inverts the axis convention', () => {
    expect(sceneToGeodetic([1, 0, 0])).toMatchObject({ latitude: 0, longitude: 0, radius: 1 });
    const east = sceneToGeodetic([0, 0, -1]);
    expect(east.latitude).toBeCloseTo(0, 12);
    expect(east.longitude).toBeCloseTo(90, 12);
    const north = sceneToGeodetic([0, 1, 0]);
    expect(north.latitude).toBeCloseTo(90, 12);
    expect(north.radius).toBe(1);
  });

  it('returns zeros at the centre rather than NaN', () => {
    expect(sceneToGeodetic([0, 0, 0])).toEqual({ latitude: 0, longitude: 0, radius: 0 });
  });

  it('round-trips a dense grid of points and radii', () => {
    const radii = [0.5, 1, 1.0307, 1.2307, 2.4];
    for (let latitude = -90; latitude <= 90; latitude += 7.5) {
      for (let longitude = -180; longitude < 180; longitude += 11.25) {
        for (const radius of radii) {
          const result = sceneToGeodetic(geodeticToScene(latitude, longitude, radius));
          expect(result.latitude).toBeCloseTo(latitude, 9);
          expect(result.radius).toBeCloseTo(radius, 12);
          // Longitude is undefined at the poles, so only compare away from them.
          if (Math.abs(latitude) < 90) {
            expect(result.longitude).toBeCloseTo(longitude, 9);
          }
        }
      }
    }
  });

  it('round-trips awkward real-world coordinates', () => {
    const points: Array<[number, number]> = [
      [51.4934, -0.0098],
      [-33.8688, 151.2093],
      [35.6762, 139.6503],
      [-0.0001, 179.9999],
      [0.0001, -179.9999],
      [89.9999, 12.34],
    ];
    for (const [latitude, longitude] of points) {
      const result = sceneToGeodetic(geodeticToScene(latitude, longitude, 1.2307));
      // asin loses precision next to the poles (about 6e-9 degrees at 89.9999), still sub-millimetre.
      expect(result.latitude).toBeCloseTo(latitude, 6);
      expect(result.longitude).toBeCloseTo(longitude, 6);
    }
  });

  it('always reports a longitude in [-180, 180)', () => {
    for (let angle = 0; angle < 360; angle += 5) {
      const result = sceneToGeodetic([-Math.cos(angle * DEG), 0.2, Math.sin(angle * DEG) * 0.3]);
      expect(result.longitude).toBeGreaterThanOrEqual(-180);
      expect(result.longitude).toBeLessThan(180);
    }
  });
});

describe('normaliseLongitude', () => {
  it('wraps +180 to -180 so the range is half-open', () => {
    expect(normaliseLongitude(180)).toBe(-180);
  });

  it('leaves -180 alone', () => {
    expect(normaliseLongitude(-180)).toBe(-180);
  });

  it('wraps whole turns', () => {
    expect(normaliseLongitude(540)).toBe(-180);
    expect(normaliseLongitude(-540)).toBe(-180);
    expect(normaliseLongitude(360)).toBe(0);
    expect(normaliseLongitude(-360)).toBe(0);
    expect(normaliseLongitude(720.5)).toBeCloseTo(0.5, 12);
  });

  it('wraps values just outside the range to the opposite side', () => {
    expect(normaliseLongitude(181)).toBeCloseTo(-179, 12);
    expect(normaliseLongitude(-181)).toBeCloseTo(179, 12);
    expect(normaliseLongitude(359.5)).toBeCloseTo(-0.5, 12);
  });

  it('keeps in-range values unchanged', () => {
    for (const value of [-179.999, -90, -0.5, 0.5, 90, 179.999]) {
      expect(normaliseLongitude(value)).toBeCloseTo(value, 12);
    }
  });

  it('never returns negative zero', () => {
    expect(Object.is(normaliseLongitude(-0), 0)).toBe(true);
    expect(Object.is(normaliseLongitude(0), 0)).toBe(true);
    expect(Object.is(normaliseLongitude(360), 0)).toBe(true);
    expect(Object.is(normaliseLongitude(-720), 0)).toBe(true);
  });
});

describe('ecfToScene', () => {
  it('maps ECF x to +X, ECF z (north) to +Y and ECF y (east) to -Z', () => {
    expect(ecfToScene({ x: 1, y: 0, z: 0 })).toEqual([1, 0, -0]);
    expect(ecfToScene({ x: 0, y: 1, z: 0 })).toEqual([0, 0, -1]);
    expect(ecfToScene({ x: 0, y: 0, z: 1 })).toEqual([0, 1, -0]);
  });

  it('applies the scale to every component', () => {
    expect(ecfToScene({ x: 1, y: 2, z: 3 }, 2)).toEqual([2, 6, -4]);
    expect(ecfToScene({ x: 1, y: 2, z: 3 })).toEqual([1, 3, -2]);
  });

  it('agrees with geodeticToScene for a unit ECF vector', () => {
    for (const [latitude, longitude] of [
      [0, 0],
      [51.6, -73.2],
      [-35, 140],
      [12, 179],
    ] as const) {
      const lat = latitude * DEG;
      const lon = longitude * DEG;
      const ecf = {
        x: Math.cos(lat) * Math.cos(lon),
        y: Math.cos(lat) * Math.sin(lon),
        z: Math.sin(lat),
      };
      expectVector(ecfToScene(ecf), geodeticToScene(latitude, longitude, 1));
    }
  });

  it('scales kilometres to scene units with 1 / Earth radius', () => {
    const [x, y, z] = ecfToScene({ x: EARTH_RADIUS_KM, y: 0, z: 0 }, 1 / EARTH_RADIUS_KM);
    expect(x).toBeCloseTo(1, 12);
    expect(y).toBe(0);
    expect(z).toBeCloseTo(0, 12);
  });
});

describe('altitudeToSceneRadius', () => {
  it('puts 420 km at about 1.2967 scene units, clear of the clouds (r ≤ 1.18)', () => {
    expect(altitudeToSceneRadius(420)).toBeCloseTo(1.2967, 3);
  });

  it('sits on the ocean surface at zero altitude', () => {
    expect(altitudeToSceneRadius(0)).toBe(EARTH_SCENE_RADIUS);
  });

  it('applies the exaggeration factor linearly', () => {
    const expected = 1 + (EARTH_RADIUS_KM / EARTH_RADIUS_KM) * ALTITUDE_EXAGGERATION;
    expect(altitudeToSceneRadius(EARTH_RADIUS_KM)).toBeCloseTo(expected, 12);
    expect(altitudeToSceneRadius(840) - 1).toBeCloseTo(2 * (altitudeToSceneRadius(420) - 1), 12);
  });

  it('keeps the ISS above the cloud layer (r up to 1.16) across its altitude range', () => {
    expect(altitudeToSceneRadius(400)).toBeGreaterThan(1.16);
    expect(altitudeToSceneRadius(440)).toBeGreaterThan(1.16);
  });
});
