import {
  fetchNasaEphemeris,
  fetchOpenNotify,
  fetchWhereIssAt,
  pickAuthoritativeSource,
} from './telemetry-sources';
import {
  getCachedJSON,
  setCachedJSON,
} from '../cache/redis';
import { getRuntimeConfig } from '../config/runtime';
import type { IssTelemetry, TelemetryState } from '../types/telemetry';

interface FetchOptions {
  allowInsecure?: boolean;
}

const TELEMETRY_CACHE_KEY = 'iss:state';

export async function loadTelemetryFromCache(): Promise<TelemetryState | null> {
  return getCachedJSON<TelemetryState>(TELEMETRY_CACHE_KEY);
}

export async function fetchLatestTelemetry(
  options: FetchOptions = { allowInsecure: true }
): Promise<TelemetryState | null> {
  const { allowInsecure = true } = options;

  const upstreamRequests = [fetchWhereIssAt(), fetchNasaEphemeris()];

  if (allowInsecure) {
    upstreamRequests.push(fetchOpenNotify());
  }

  const results = await Promise.all(upstreamRequests);
  const whereIssAt = results[0];
  const nasaEphemeris = results[1];
  const openNotify = allowInsecure ? results[2] : undefined;

  const responses = [whereIssAt, nasaEphemeris];
  if (openNotify) {
    responses.push(openNotify);
  }

  const authority = pickAuthoritativeSource(responses);

  if (!authority || !authority.data) {
    return null;
  }

  const fallback = (() => {
    if (authority.data?.source === 'where-iss-at') {
      return nasaEphemeris?.data ?? openNotify?.data ?? null;
    }
    return whereIssAt?.data ?? openNotify?.data ?? null;
  })();

  const drift = fallback
    ? calculateDrift(authority.data, fallback)
    : undefined;

  const envelope = {
    data: authority.data,
    receivedAt: authority.fetchedAt,
    upstreamLatencyMs: authority.latencyMs ?? null,
    cacheStatus: 'miss',
  } as const;

  const state: TelemetryState = {
    envelope,
    drift,
  };

  await persistTelemetry(state);

  return state;
}

export async function persistTelemetry(state: TelemetryState): Promise<void> {
  const { TELEMETRY_CACHE_TTL_SECONDS } = getRuntimeConfig();
  await setCachedJSON(TELEMETRY_CACHE_KEY, state, TELEMETRY_CACHE_TTL_SECONDS);
}

export async function getTelemetryState(): Promise<TelemetryState | null> {
  const cached = await loadTelemetryFromCache();
  if (cached) {
    return {
      ...cached,
      envelope: {
        ...cached.envelope,
        cacheStatus: 'hit',
      },
    } satisfies TelemetryState;
  }

  return fetchLatestTelemetry();
}

function calculateDrift(
  primary: IssTelemetry,
  fallback: IssTelemetry
): TelemetryState['drift'] {
  const deltaAltitudeKm = primary.altitudeKm - fallback.altitudeKm;
  const deltaVelocityKps = primary.velocityKps - fallback.velocityKps;
  const deltaGreatCircleKm = greatCircleDistanceKm(primary, fallback);

  return {
    deltaAltitudeKm,
    deltaVelocityKps,
    deltaGreatCircleKm,
    referenceSource: fallback.source,
  };
}

const EARTH_RADIUS_KM = 6371;

export function greatCircleDistanceKm(
  a: IssTelemetry,
  b: IssTelemetry
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  const centralAngle = 2 * Math.asin(Math.min(1, Math.sqrt(haversine)));
  return centralAngle * EARTH_RADIUS_KM;
}

