import type { LiveTelemetry } from '@/lib/api/iss-telemetry';
import { formatDistance } from '@/lib/format/units';
import { EARTH_RADIUS_KM } from '@/lib/orbit/frames';
import type { GeoPoint, OrbitState } from '@/lib/orbit/types';
import type { Units } from '@/lib/state/tracker-store';

/** Beyond this the two sources disagree by more than ordinary TLE error. */
const STALE_DRIFT_KM = 50;

export interface Reading {
  latitude: number;
  longitude: number;
  altitudeKm: number;
  speedKps: number;
  /** "model" is our own SGP4 maths; "feed" is the live API used when no TLE could be loaded. */
  source: 'model' | 'feed';
}

export function pickReading(state: OrbitState | null, telemetry: LiveTelemetry | null): Reading | null {
  const source = state ?? telemetry;
  if (!source) return null;
  return {
    latitude: source.latitude,
    longitude: source.longitude,
    altitudeKm: source.altitudeKm,
    speedKps: source.speedKps,
    source: state ? 'model' : 'feed',
  };
}

/** Haversine distance, which stays correct across the antimeridian. */
export function greatCircleKm(a: GeoPoint, b: GeoPoint): number {
  const toRadians = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * toRadians;
  const dLon = (b.longitude - a.longitude) * toRadians;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * toRadians) * Math.cos(b.latitude * toRadians) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Splits "27,580 km/h" into its number and unit so the unit can be styled separately. */
export function splitUnit(text: string): { value: string; unit: string } {
  const index = text.lastIndexOf(' ');
  if (index === -1) return { value: text, unit: '' };
  return { value: text.slice(0, index), unit: text.slice(index + 1) };
}

export function describeDrift(driftKm: number, units: Units): string {
  if (driftKm < 1) return 'Our orbit maths agrees with the live feed to within a kilometre.';
  const gap = `Our orbit maths is ${formatDistance(driftKm, units)} from the live feed.`;
  return driftKm > STALE_DRIFT_KM ? `${gap} The saved orbit data may be getting old.` : gap;
}
