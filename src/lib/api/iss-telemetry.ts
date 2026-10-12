import { z } from 'zod';

import { fetchJson, formatZodError } from '@/lib/api/iss-tle';
import { normaliseLongitude } from '@/lib/orbit/frames';
import type { GeoPoint } from '@/lib/orbit/types';

export const WHERETHEISS_ISS_URL = 'https://api.wheretheiss.at/v1/satellites/25544';

const SECONDS_PER_HOUR = 3600;

export interface LiveTelemetry {
  time: Date;
  latitude: number;
  longitude: number;
  altitudeKm: number;
  /** Km per second; the API reports km/h. */
  speedKps: number;
  visibility: 'daylight' | 'eclipsed';
  footprintKm: number;
  /** Sub-solar point, longitude in [-180, 180). */
  solar: GeoPoint;
}

const finite = z.number().finite();

const rawTelemetrySchema = z.object({
  latitude: finite.min(-90).max(90),
  longitude: finite,
  altitude: finite.nonnegative(),
  velocity: finite.nonnegative(),
  // 'visible' means sunlit while the ground below is dark, so it still maps to sunlit.
  visibility: z.enum(['daylight', 'visible', 'eclipsed']),
  footprint: finite.nonnegative(),
  timestamp: finite.positive(),
  solar_lat: finite.min(-90).max(90),
  solar_lon: finite,
  // The conversions below assume kilometres; refuse a payload in any other unit.
  units: z.literal('kilometers').optional(),
});

/** normaliseLongitude adds and subtracts 180, which perturbs in-range values by float noise. */
const wrapLongitude = (degrees: number): number =>
  degrees >= -180 && degrees < 180 ? degrees : normaliseLongitude(degrees);

/** Pure boundary step: validates the wheretheiss payload and converts units and ranges. */
export function normaliseTelemetry(json: unknown): LiveTelemetry {
  const result = rawTelemetrySchema.safeParse(json);
  if (!result.success) {
    throw new Error(`Invalid ISS telemetry payload: ${formatZodError(result.error)}`);
  }
  const raw = result.data;
  return {
    time: new Date(raw.timestamp * 1000),
    latitude: raw.latitude,
    longitude: wrapLongitude(raw.longitude),
    altitudeKm: raw.altitude,
    speedKps: raw.velocity / SECONDS_PER_HOUR,
    visibility: raw.visibility === 'eclipsed' ? 'eclipsed' : 'daylight',
    footprintKm: raw.footprint,
    solar: { latitude: raw.solar_lat, longitude: wrapLongitude(raw.solar_lon) },
  };
}

export async function fetchIssTelemetry(signal?: AbortSignal): Promise<LiveTelemetry> {
  return normaliseTelemetry(await fetchJson(WHERETHEISS_ISS_URL, { signal }));
}
