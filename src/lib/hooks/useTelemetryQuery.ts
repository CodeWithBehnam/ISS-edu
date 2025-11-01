import { useQuery } from '@tanstack/react-query';
import type { TelemetryState, IssTelemetry } from '@/lib/types/telemetry';

const WHERE_ISS_AT_URL = 'https://api.wheretheiss.at/v1/satellites/25544';

async function fetchTelemetry(): Promise<TelemetryState> {
  const response = await fetch(WHERE_ISS_AT_URL, {
    headers: {
      'User-Agent': 'Orbital-Learning-Hub/0.1',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Unable to load telemetry.');
  }

  const data = await response.json();
  const telemetry: IssTelemetry = {
    timestamp: new Date(data.timestamp * 1000).toISOString(),
    latitude: data.latitude,
    longitude: data.longitude,
    altitudeKm: data.altitude,
    velocityKps: data.velocity,
    visibility: data.visibility || 'daylight',
    footprintKm: data.footprint || 0,
    source: 'where-iss-at',
  };

  return {
    envelope: {
      data: telemetry,
      receivedAt: new Date().toISOString(),
      upstreamLatencyMs: null,
      cacheStatus: 'miss',
    },
  };
}

export function useTelemetryQuery() {
  return useQuery({
    queryKey: ['telemetry', 'iss'],
    queryFn: fetchTelemetry,
    refetchInterval: 5_000,
  });
}

