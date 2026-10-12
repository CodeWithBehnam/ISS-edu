import { useEffect, useState } from 'react';

import { errorMessage } from '@/lib/api/iss-tle';
import { clientLog } from '@/lib/observability/client-log';
import { findPasses, type Pass } from '@/lib/orbit/passes';
import type { SatRec } from '@/lib/orbit/types';
import type { Observer } from '@/lib/state/tracker-store';

const REFRESH_MS = 10 * 60 * 1000;
/** Gives React a chance to paint the "computing" state before the synchronous search blocks. */
const DEFER_MS = 50;

export interface PassesResult {
  passes: Pass[];
  computing: boolean;
  computedAt: Date | null;
}

interface Computed {
  /** Observer the passes were computed for, so a new location never shows the old one's passes. */
  key: string;
  passes: Pass[];
  computedAt: Date;
}

const observerKey = (latitude: number, longitude: number): string => `${latitude},${longitude}`;

/** Upcoming passes from real "now" (not sim time), recomputed every 10 minutes. */
export function usePasses(satrec: SatRec | null, observer: Observer | null): PassesResult {
  const latitude = observer?.latitude;
  const longitude = observer?.longitude;
  const key =
    latitude === undefined || longitude === undefined ? null : observerKey(latitude, longitude);

  const [computed, setComputed] = useState<Computed | null>(null);
  const [computing, setComputing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const active = satrec !== null && key !== null;

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setRefreshToken((token) => token + 1), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => {
    if (!satrec || latitude === undefined || longitude === undefined) {
      setComputing(false);
      return;
    }
    // The flag outlives the callback so a superseded run can never overwrite newer results.
    let cancelled = false;
    setComputing(true);

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const from = new Date();
      try {
        const passes = findPasses(satrec, { latitude, longitude }, from);
        if (!cancelled) {
          setComputed({ key: observerKey(latitude, longitude), passes, computedAt: from });
        }
      } catch (error) {
        clientLog('error', 'passes-failed', { message: errorMessage(error) });
      } finally {
        if (!cancelled) setComputing(false);
      }
    }, DEFER_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [satrec, latitude, longitude, refreshToken]);

  const current = computed && computed.key === key ? computed : null;
  return {
    passes: current?.passes ?? [],
    computing,
    computedAt: current?.computedAt ?? null,
  };
}
