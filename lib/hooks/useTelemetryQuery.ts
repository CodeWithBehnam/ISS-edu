'use client';

import { useQuery } from '@tanstack/react-query';

import type { TelemetryState } from '@/lib/types/telemetry';

async function fetchTelemetry(): Promise<TelemetryState> {
  const response = await fetch('/api/iss/live', {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Unable to load telemetry.');
  }

  return (await response.json()) as TelemetryState;
}

export function useTelemetryQuery() {
  return useQuery({
    queryKey: ['telemetry', 'iss'],
    queryFn: fetchTelemetry,
    refetchInterval: 5_000,
  });
}

