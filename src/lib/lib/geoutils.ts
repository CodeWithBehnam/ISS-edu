/**
 * Geographic and coordinate transformation utilities.
 */

import { Vector3 } from 'three';

const EARTH_RADIUS_KM = 6371;

/**
 * Converts latitude/longitude to 3D vector on a sphere.
 * Returns Vector3 in three.js coordinate system.
 */
export function latLonToVector3(
  lat: number,
  lon: number,
  radius: number
): Vector3 {
  const phi = (90 - lat) * (Math.PI / 180); // Colatitude
  const theta = (lon + 180) * (Math.PI / 180); // Longitude offset

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new Vector3(x, y, z);
}

/**
 * Converts 3D vector to latitude/longitude.
 */
export function vector3ToLatLon(vector: Vector3, radius: number): {
  latitude: number;
  longitude: number;
} {
  const x = vector.x;
  const y = vector.y;
  const z = vector.z;

  const phi = Math.acos(y / radius); // Colatitude
  const theta = Math.atan2(z, -x); // Longitude

  const latitude = 90 - (phi * 180) / Math.PI;
  const longitude = (theta * 180) / Math.PI - 180;

  return { latitude, longitude };
}

/**
 * Computes great circle distance between two lat/lon points.
 */
export function greatCircleDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLon / 2) ** 2;

  const c = 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  return c * EARTH_RADIUS_KM;
}

/**
 * Formats distance in kilometres to human-readable string.
 */
export function formatDistance(km: number, useImperial: boolean = false): string {
  if (useImperial) {
    const miles = km * 0.621371;
    return miles >= 1 ? `${miles.toFixed(1)} mi` : `${(miles * 5280).toFixed(0)} ft`;
  }
  return km >= 1 ? `${km.toFixed(1)} km` : `${(km * 1000).toFixed(0)} m`;
}

/**
 * Formats altitude in kilometres.
 */
export function formatAltitude(km: number, useImperial: boolean = false): string {
  if (useImperial) {
    const miles = km * 0.621371;
    return `${miles.toFixed(2)} mi`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Formats velocity in km/s.
 */
export function formatVelocity(kmPerSec: number, useImperial: boolean = false): string {
  if (useImperial) {
    const mph = kmPerSec * 2236.94;
    return `${mph.toFixed(0)} mph`;
  }
  return `${kmPerSec.toFixed(2)} km/s`;
}

