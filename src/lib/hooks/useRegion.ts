import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { errorMessage, fetchJson } from '@/lib/api/iss-tle';
import { findRegion, parseCountries, type CountryShape, type RegionLabel } from '@/lib/geo/regions';
import { clientLog } from '@/lib/observability/client-log';
import type { GeoPoint } from '@/lib/orbit/types';

export const COUNTRIES_QUERY_KEY = ['geo', 'countries'] as const;

async function fetchCountries(signal?: AbortSignal): Promise<CountryShape[]> {
  const url = `${import.meta.env.BASE_URL}data/countries-110m.json`;
  try {
    return parseCountries(await fetchJson(url, { signal, timeoutMs: 20_000 }));
  } catch (error) {
    // A cancelled request (the page closing, say) is not a failure worth reporting.
    if (!signal?.aborted) clientLog('warn', 'countries-load-failed', { message: errorMessage(error) });
    throw error;
  }
}

/** Static boundary data: fetched once per session and never refetched. */
export function useCountries() {
  return useQuery({
    queryKey: COUNTRIES_QUERY_KEY,
    queryFn: ({ signal }) => fetchCountries(signal),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
  });
}

/** Country or ocean under `point`; null until the boundary data has loaded or without a point. */
export function useRegion(point: GeoPoint | null): RegionLabel | null {
  const { data: countries } = useCountries();
  const latitude = point?.latitude;
  const longitude = point?.longitude;

  return useMemo(() => {
    if (!countries || latitude === undefined || longitude === undefined) return null;
    return findRegion({ latitude, longitude }, countries);
  }, [countries, latitude, longitude]);
}
