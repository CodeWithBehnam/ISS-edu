import { useEffect, useState } from 'react';

import { currentSimMs, isLive } from '@/lib/time/sim-clock';
import { useTrackerStore } from '@/lib/state/tracker-store';

const MIN_INTERVAL_MS = 16;

/* Module-level so their identity is stable across renders and effects never re-subscribe. */
const readSimNow = (): Date => new Date(currentSimMs(useTrackerStore.getState().clock, Date.now()));
const readIsLive = (): boolean => isLive(useTrackerStore.getState().clock, Date.now());
const sameInstant = (a: Date, b: Date): boolean => a.getTime() === b.getTime();
const sameValue = (a: boolean, b: boolean): boolean => a === b;

/**
 * Samples a value derived from the sim clock: one interval per hook instance, plus an
 * immediate resample when the clock itself changes so scrubbing and "back to live" feel instant.
 */
function useClockSample<T>(read: () => T, same: (a: T, b: T) => boolean, intervalMs: number): T {
  const [value, setValue] = useState<T>(read);

  useEffect(() => {
    const sample = (): void => {
      const next = read();
      setValue((previous) => (same(previous, next) ? previous : next));
    };
    sample();
    const timer = window.setInterval(sample, intervalMs);
    const unsubscribe = useTrackerStore.subscribe((state, previous) => {
      if (state.clock !== previous.clock) sample();
    });
    return () => {
      window.clearInterval(timer);
      unsubscribe();
    };
  }, [read, same, intervalMs]);

  return value;
}

/** Current sim time, refreshed `hz` times per second (paused clocks do not re-render). */
export function useSimNow(hz = 4): Date {
  return useClockSample(readSimNow, sameInstant, Math.max(MIN_INTERVAL_MS, 1000 / hz));
}

/** True while the sim clock is running at 1x and sits on real time. Checked at 1 Hz. */
export function useIsLive(): boolean {
  return useClockSample(readIsLive, sameValue, 1000);
}
