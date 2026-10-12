import { useCallback, useState } from 'react';

/**
 * Wraps a query's `refetch` for a "Try again" button. A query that never had data forgets its error
 * the moment it refetches, which would swap the button for a skeleton and drop keyboard focus; `retrying`
 * lets the caller keep the failure message on screen until the attempt has finished.
 */
export function useRetry(refetch: () => Promise<unknown>): { retry: () => void; retrying: boolean } {
  const [retrying, setRetrying] = useState(false);
  const retry = useCallback(() => {
    setRetrying(true);
    void refetch().finally(() => setRetrying(false));
  }, [refetch]);
  return { retry, retrying };
}
