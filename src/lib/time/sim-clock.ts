/**
 * Simulation clock: maps real wall-clock time to the time the tracker displays.
 * Pure functions; the store keeps one SimClock value and re-anchors it on every change.
 */

export const PLAYBACK_RATES = [1, 60, 600] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

/** How far the time scrubber and fast playback may move away from now. */
export const SIM_WINDOW_MS = 12 * 60 * 60 * 1000;
/** Sim time within this distance of real time at 1x counts as live. */
export const LIVE_TOLERANCE_MS = 2_000;

export interface SimClock {
  anchorRealMs: number;
  anchorSimMs: number;
  rate: PlaybackRate;
  paused: boolean;
}

export function createLiveClock(realNowMs: number): SimClock {
  return { anchorRealMs: realNowMs, anchorSimMs: realNowMs, rate: 1, paused: false };
}

function rawSimMs(clock: SimClock, realNowMs: number): number {
  if (clock.paused) return clock.anchorSimMs;
  return clock.anchorSimMs + (realNowMs - clock.anchorRealMs) * clock.rate;
}

/** Current sim time, clamped to the ±SIM_WINDOW_MS window around real time. */
export function currentSimMs(clock: SimClock, realNowMs: number): number {
  const sim = rawSimMs(clock, realNowMs);
  return Math.min(realNowMs + SIM_WINDOW_MS, Math.max(realNowMs - SIM_WINDOW_MS, sim));
}

function reanchor(clock: SimClock, realNowMs: number): SimClock {
  return { ...clock, anchorRealMs: realNowMs, anchorSimMs: currentSimMs(clock, realNowMs) };
}

export function withRate(clock: SimClock, rate: PlaybackRate, realNowMs: number): SimClock {
  return { ...reanchor(clock, realNowMs), rate };
}

export function withPaused(clock: SimClock, paused: boolean, realNowMs: number): SimClock {
  return { ...reanchor(clock, realNowMs), paused };
}

export function scrubbedTo(clock: SimClock, simMs: number, realNowMs: number): SimClock {
  const clamped = Math.min(realNowMs + SIM_WINDOW_MS, Math.max(realNowMs - SIM_WINDOW_MS, simMs));
  return { ...clock, anchorRealMs: realNowMs, anchorSimMs: clamped };
}

export function isLive(clock: SimClock, realNowMs: number): boolean {
  return (
    clock.rate === 1 &&
    !clock.paused &&
    Math.abs(currentSimMs(clock, realNowMs) - realNowMs) <= LIVE_TOLERANCE_MS
  );
}
