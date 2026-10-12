import { useEffect, useMemo, useState } from 'react';

import { isInEarthShadow, nextShadowTransition, type ShadowTransition } from '@/lib/astro/sun';
import { useSimNow } from '@/lib/hooks/useSimNow';
import { propagateState } from '@/lib/orbit/satrec';
import type { SatRec } from '@/lib/orbit/types';

/** Matches the search horizon of nextShadowTransition, which is 120 minutes by default. */
const SEARCH_HORIZON_MS = 120 * 60 * 1000;
const JUMP_MS = 5 * 60 * 1000;

interface TransitionCache {
  satrec: SatRec;
  computedAtMs: number;
  transition: ShadowTransition | null;
}

/**
 * A cached "next transition" stays valid while sim time sits between the moment it was
 * computed and the transition itself. It is stale once time passes the transition, runs
 * backwards (an earlier event may now be next), or, when no transition was found, once the
 * search horizon has moved on by more than a jump.
 */
export function isTransitionCacheStale(
  cache: TransitionCache | null,
  satrec: SatRec,
  nowMs: number,
): boolean {
  if (!cache || cache.satrec !== satrec) return true;
  if (nowMs < cache.computedAtMs) return true;
  if (cache.transition) return nowMs >= cache.transition.at.getTime();
  return nowMs - cache.computedAtMs > SEARCH_HORIZON_MS - JUMP_MS;
}

export interface Sunlight {
  sunlit: boolean | null;
  next: ShadowTransition | null;
}

export function useSunlight(satrec: SatRec | null): Sunlight {
  const now = useSimNow(1);
  const nowMs = now.getTime();
  const [cache, setCache] = useState<TransitionCache | null>(null);

  const sunlit = useMemo(() => {
    if (!satrec) return null;
    const state = propagateState(satrec, now);
    return state ? !isInEarthShadow(state.eci, now) : null;
  }, [satrec, now]);

  useEffect(() => {
    if (!satrec) {
      setCache(null);
      return;
    }
    if (!isTransitionCacheStale(cache, satrec, nowMs)) return;
    setCache({
      satrec,
      computedAtMs: nowMs,
      transition: nextShadowTransition(satrec, new Date(nowMs)),
    });
  }, [satrec, nowMs, cache]);

  const next = satrec && cache?.satrec === satrec ? cache.transition : null;
  return useMemo(() => ({ sunlit, next }), [sunlit, next]);
}
