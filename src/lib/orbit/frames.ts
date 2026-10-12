import type { GeoPoint, Vec3 } from './types';

/**
 * Scene frame (Earth-fixed, three.js Y-up), shared with the Blender-made glTF models:
 *   +Y = north pole, +X = (lat 0, lon 0), -Z = (lat 0, lon 90° E).
 * Matches the Blender convention x = cosφ·cosλ, y = cosφ·sinλ, z = sinφ after the
 * glTF exporter's Z-up to Y-up conversion (x, y, z) -> (x, z, -y).
 */
export type Tuple3 = [number, number, number];

export const EARTH_RADIUS_KM = 6371;
/** Ocean surface radius of the Earth model, scene units. */
export const EARTH_SCENE_RADIUS = 1;
/**
 * Real altitude (~420 km) would put the ISS inside the cute cloud layer (r ≈ 1.12-1.18), so it is
 * exaggerated (r ≈ 1.30). The height also gives the follow view enough parallax to show the ground
 * beneath the station instead of hiding it behind the model.
 */
export const ALTITUDE_EXAGGERATION = 4.5;

const DEG = Math.PI / 180;

export function altitudeToSceneRadius(altitudeKm: number): number {
  return EARTH_SCENE_RADIUS * (1 + (altitudeKm / EARTH_RADIUS_KM) * ALTITUDE_EXAGGERATION);
}

export function geodeticToScene(latitudeDeg: number, longitudeDeg: number, radius: number): Tuple3 {
  const lat = latitudeDeg * DEG;
  const lon = longitudeDeg * DEG;
  const cosLat = Math.cos(lat);
  return [radius * cosLat * Math.cos(lon), radius * Math.sin(lat), -radius * cosLat * Math.sin(lon)];
}

export function sceneToGeodetic([x, y, z]: Tuple3): GeoPoint & { radius: number } {
  const radius = Math.hypot(x, y, z);
  if (radius === 0) return { latitude: 0, longitude: 0, radius: 0 };
  return {
    latitude: Math.asin(y / radius) / DEG,
    longitude: normaliseLongitude(Math.atan2(-z, x) / DEG),
    radius,
  };
}

/** Earth-centred Earth-fixed vector (x to lon 0, y to lon 90° E, z north) into the scene frame. */
export function ecfToScene(v: Vec3, scale = 1): Tuple3 {
  return [v.x * scale, v.z * scale, -v.y * scale];
}

/** Wraps any longitude into [-180, 180). */
export function normaliseLongitude(longitudeDeg: number): number {
  const wrapped = ((((longitudeDeg + 180) % 360) + 360) % 360) - 180;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}
