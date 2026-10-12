import { useQuery } from '@tanstack/react-query';

import { fetchIssTelemetry } from '@/lib/api/iss-telemetry';

const POLL_INTERVAL_MS = 5_000;

export const ISS_TELEMETRY_QUERY_KEY = ['iss', 'telemetry'] as const;

export function useIssTelemetry() {
  return useQuery({
    queryKey: ISS_TELEMETRY_QUERY_KEY,
    queryFn: ({ signal }) => fetchIssTelemetry(signal),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: POLL_INTERVAL_MS - 1_000,
    retry: 1,
  });
}
