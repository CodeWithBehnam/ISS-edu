/**
 * Hook for managing ISS TLE data fetching and caching.
 * Automatically refreshes TLE every 6 hours.
 */



import { useEffect, useCallback } from 'react';
import { getIssTle } from '../api/tle';
import { useOrbitStore } from '../state/orbit-store';

export function useTleManager() {
  const { tle, setTle, setTleLoading, setTleError } = useOrbitStore();

  const fetchTle = useCallback(async () => {
    setTleLoading(true);
    setTleError(null);

    try {
      const tleData = await getIssTle();
      setTle(tleData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch TLE';
      setTleError(message);
      console.error('TLE fetch error:', error);
    } finally {
      setTleLoading(false);
    }
  }, [setTle, setTleLoading, setTleError]);

  useEffect(() => {
    // Fetch on mount if not cached
    if (!tle) {
      void fetchTle();
    }

    // Refresh every 6 hours
    const interval = setInterval(() => {
      void fetchTle();
    }, 6 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [tle, fetchTle]);

  return { tle, fetchTle, isLoading: useOrbitStore((s) => s.tleLoading), error: useOrbitStore((s) => s.tleError) };
}

