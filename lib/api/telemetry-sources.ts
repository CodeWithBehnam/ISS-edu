import { getRuntimeConfig } from '../config/runtime';
import type { IssTelemetry, TelemetrySource, UpstreamResponse } from '../types/telemetry';

const WHERE_ISS_AT_URL = 'https://api.wheretheiss.at/v1/satellites/25544';
const OPEN_NOTIFY_URL = 'http://api.open-notify.org/iss-now.json';
const NASA_TRAJECTORY_URL =
  'https://api.nasa.gov/iss-now/v1/trajectory';

interface WhereIssAtResponse {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  visibility: 'daylight' | 'twilight' | 'night';
  footprint: number;
  timestamp: number;
}

interface OpenNotifyResponse {
  timestamp: number;
  iss_position: {
    latitude: string;
    longitude: string;
  };
}

interface NasaTrajectoryResponse {
  name: string;
  id: number;
  timestamp: string;
  position: {
    latitude: number;
    longitude: number;
    altitude: number;
  };
  velocity: number;
}

async function fetchJSON<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<UpstreamResponse<T>> {
  const startedAt = Date.now();
  try {
    const response = await fetch(input, {
      ...init,
      headers: {
        'User-Agent': 'Orbital-Learning-Hub/0.1 (+https://orbital-learning-hub)',
        'Accept': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const message = await response.text();
      return {
        data: null,
        error: `HTTP ${response.status}: ${message}`,
        fetchedAt: new Date().toISOString(),
        latencyMs,
      };
    }

    const json = (await response.json()) as T;
    return {
      data: json,
      fetchedAt: new Date().toISOString(),
      latencyMs,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      fetchedAt: new Date().toISOString(),
    };
  }
}

function normaliseWhereIssAt(
  payload: WhereIssAtResponse
): IssTelemetry {
  return {
    timestamp: new Date(payload.timestamp * 1000).toISOString(),
    latitude: payload.latitude,
    longitude: payload.longitude,
    altitudeKm: payload.altitude,
    velocityKps: payload.velocity,
    visibility: payload.visibility,
    footprintKm: payload.footprint,
    source: 'where-iss-at',
  } satisfies IssTelemetry;
}

function normaliseOpenNotify(payload: OpenNotifyResponse): IssTelemetry {
  return {
    timestamp: new Date(payload.timestamp * 1000).toISOString(),
    latitude: Number.parseFloat(payload.iss_position.latitude),
    longitude: Number.parseFloat(payload.iss_position.longitude),
    altitudeKm: Number.NaN,
    velocityKps: Number.NaN,
    visibility: 'twilight',
    footprintKm: Number.NaN,
    source: 'open-notify',
  } satisfies IssTelemetry;
}

function normaliseNasaEphemeris(
  payload: NasaTrajectoryResponse
): IssTelemetry {
  return {
    timestamp: payload.timestamp,
    latitude: payload.position.latitude,
    longitude: payload.position.longitude,
    altitudeKm: payload.position.altitude,
    velocityKps: payload.velocity,
    visibility: 'twilight',
    footprintKm: Number.NaN,
    source: 'nasa-ephemeris',
  } satisfies IssTelemetry;
}

export async function fetchWhereIssAt(): Promise<UpstreamResponse<IssTelemetry>> {
  const upstream = await fetchJSON<WhereIssAtResponse>(WHERE_ISS_AT_URL);
  if (!upstream.data) return upstream as UpstreamResponse<IssTelemetry>;
  return {
    ...upstream,
    data: normaliseWhereIssAt(upstream.data),
  };
}

export async function fetchOpenNotify(): Promise<UpstreamResponse<IssTelemetry>> {
  const upstream = await fetchJSON<OpenNotifyResponse>(OPEN_NOTIFY_URL);
  if (!upstream.data) return upstream as UpstreamResponse<IssTelemetry>;
  return {
    ...upstream,
    data: normaliseOpenNotify(upstream.data),
  };
}

export async function fetchNasaEphemeris(): Promise<UpstreamResponse<IssTelemetry>> {
  const { NASA_API_KEY } = getRuntimeConfig();
  
  if (!NASA_API_KEY) {
    return {
      data: null,
      error: 'NASA_API_KEY not configured',
      fetchedAt: new Date().toISOString(),
    };
  }
  
  const url = new URL(NASA_TRAJECTORY_URL);
  url.searchParams.set('api_key', NASA_API_KEY);

  const upstream = await fetchJSON<NasaTrajectoryResponse>(url.toString());
  if (!upstream.data) return upstream as UpstreamResponse<IssTelemetry>;
  return {
    ...upstream,
    data: normaliseNasaEphemeris(upstream.data),
  };
}

export function pickAuthoritativeSource(
  responses: Array<UpstreamResponse<IssTelemetry>>
): UpstreamResponse<IssTelemetry> | null {
  const successful = responses.filter((response) => response.data);
  if (successful.length === 0) return null;

  const priority: TelemetrySource[] = [
    'where-iss-at',
    'nasa-ephemeris',
    'open-notify',
  ];

  return (
    successful.find((response) =>
      response.data ? priority.indexOf(response.data.source) === 0 : false
    ) ?? successful[0]
  );
}

