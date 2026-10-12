import type { SatRec } from 'satellite.js';

export type { SatRec };

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface GeoPoint {
  /** Degrees, positive north. */
  latitude: number;
  /** Degrees in [-180, 180), positive east. */
  longitude: number;
}

export interface TleRecord {
  name: string;
  line1: string;
  line2: string;
  /** TLE epoch, ISO 8601 UTC. */
  epoch: string;
  source: 'celestrak' | 'wheretheiss';
  /** ISO 8601 UTC. */
  fetchedAt: string;
}

/** Instantaneous ISS state derived from SGP4. */
export interface OrbitState extends GeoPoint {
  time: Date;
  altitudeKm: number;
  /** Inertial speed, km/s. */
  speedKps: number;
  /** TEME/ECI position, km. */
  eci: Vec3;
  /** TEME/ECI velocity, km/s. */
  eciVelocity: Vec3;
  /** Greenwich mean sidereal time, radians. */
  gmst: number;
}
