import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getIssTle } from '@/lib/api/iss-tle';
import { clientLog } from '@/lib/observability/client-log';
import { createSatrec } from '@/lib/orbit/satrec';
import type { SatRec, TleRecord } from '@/lib/orbit/types';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export const ISS_TLE_QUERY_KEY = ['iss', 'tle'] as const;

export function useIssTle() {
  return useQuery({
    queryKey: ISS_TLE_QUERY_KEY,
    queryFn: ({ signal }) => getIssTle(signal),
    staleTime: SIX_HOURS_MS,
    refetchInterval: SIX_HOURS_MS,
    retry: 3,
  });
}

interface SatrecResult {
  satrec: SatRec | null;
  error: Error | null;
}

const NO_SATREC: SatrecResult = { satrec: null, error: null };

function buildSatrec(line1: string | undefined, line2: string | undefined): SatrecResult {
  if (!line1 || !line2) return NO_SATREC;
  try {
    return { satrec: createSatrec({ line1, line2 }), error: null };
  } catch (error) {
    return { satrec: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

export function useSatrec(): {
  satrec: SatRec | null;
  tle: TleRecord | null;
  error: Error | null;
  isLoading: boolean;
  /** Fetches the TLE again, whatever the cache says. Never rejects: a failure shows up in `error`. */
  refetch: () => Promise<unknown>;
} {
  const query = useIssTle();
  const tle = query.data ?? null;
  const line1 = tle?.line1;
  const line2 = tle?.line2;

  // Keyed on the element lines, not the record, so a refetch of the same TLE keeps one SatRec.
  const built = useMemo(() => buildSatrec(line1, line2), [line1, line2]);

  useEffect(() => {
    if (built.error) clientLog('error', 'satrec-init-failed', { message: built.error.message });
  }, [built.error]);

  return {
    satrec: built.satrec,
    tle,
    error: built.error ?? query.error,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
