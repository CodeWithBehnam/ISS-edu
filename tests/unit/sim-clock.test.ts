import { describe, expect, it } from 'vitest';
import {
  LIVE_TOLERANCE_MS,
  PLAYBACK_RATES,
  SIM_WINDOW_MS,
  createLiveClock,
  currentSimMs,
  isLive,
  scrubbedTo,
  withPaused,
  withRate,
} from '@/lib/time/sim-clock';

const T0 = Date.UTC(2026, 9, 12, 12, 0, 0);
const SECOND = 1000;
const HOUR = 3_600_000;

describe('constants', () => {
  it('offers 1x, 60x and 600x playback within a 12 hour window', () => {
    expect([...PLAYBACK_RATES]).toEqual([1, 60, 600]);
    expect(SIM_WINDOW_MS).toBe(12 * HOUR);
  });
});

describe('live clock', () => {
  it('starts anchored at real time, running at 1x', () => {
    const clock = createLiveClock(T0);
    expect(clock).toEqual({ anchorRealMs: T0, anchorSimMs: T0, rate: 1, paused: false });
  });

  it('tracks real time exactly', () => {
    const clock = createLiveClock(T0);
    expect(currentSimMs(clock, T0)).toBe(T0);
    expect(currentSimMs(clock, T0 + 5 * SECOND)).toBe(T0 + 5 * SECOND);
    expect(currentSimMs(clock, T0 + HOUR)).toBe(T0 + HOUR);
  });

  it('is live', () => {
    const clock = createLiveClock(T0);
    expect(isLive(clock, T0)).toBe(true);
    expect(isLive(clock, T0 + HOUR)).toBe(true);
  });
});

describe('withRate', () => {
  it('re-anchors so sim time does not jump when the rate changes', () => {
    const live = createLiveClock(T0);
    const changeAt = T0 + 10 * SECOND;
    const fast = withRate(live, 60, changeAt);

    expect(currentSimMs(fast, changeAt)).toBe(currentSimMs(live, changeAt));
    expect(fast.anchorRealMs).toBe(changeAt);
    expect(fast.rate).toBe(60);
  });

  it('advances at the new rate from the change point', () => {
    const fast = withRate(createLiveClock(T0), 60, T0 + 10 * SECOND);
    expect(currentSimMs(fast, T0 + 11 * SECOND)).toBe(T0 + 10 * SECOND + 60 * SECOND);
    expect(currentSimMs(withRate(fast, 600, T0 + 11 * SECOND), T0 + 12 * SECOND)).toBe(
      T0 + 10 * SECOND + 60 * SECOND + 600 * SECOND,
    );
  });

  it('returns to real-time speed without a jump', () => {
    const fast = withRate(createLiveClock(T0), 60, T0);
    const backAt = T0 + 30 * SECOND;
    const slow = withRate(fast, 1, backAt);
    const simAtSwitch = T0 + 30 * 60 * SECOND;
    expect(currentSimMs(slow, backAt)).toBe(simAtSwitch);
    expect(currentSimMs(slow, backAt + 4 * SECOND)).toBe(simAtSwitch + 4 * SECOND);
  });

  it('does not mutate the original clock', () => {
    const live = createLiveClock(T0);
    withRate(live, 600, T0 + SECOND);
    expect(live).toEqual({ anchorRealMs: T0, anchorSimMs: T0, rate: 1, paused: false });
  });

  it('anchors at the clamped value, not the unbounded raw value', () => {
    const fast = withRate(createLiveClock(T0), 600, T0);
    const twoHoursLater = T0 + 2 * HOUR;
    const slowed = withRate(fast, 1, twoHoursLater);
    expect(slowed.anchorSimMs).toBe(twoHoursLater + SIM_WINDOW_MS);
    expect(currentSimMs(slowed, twoHoursLater + SECOND)).toBe(twoHoursLater + SIM_WINDOW_MS + SECOND);
  });
});

describe('withPaused', () => {
  it('freezes sim time at the moment of pausing', () => {
    const pausedAt = T0 + 20 * SECOND;
    const paused = withPaused(createLiveClock(T0), true, pausedAt);
    expect(paused.paused).toBe(true);
    expect(currentSimMs(paused, pausedAt)).toBe(pausedAt);
    expect(currentSimMs(paused, pausedAt + 10 * SECOND)).toBe(pausedAt);
    expect(currentSimMs(paused, pausedAt + HOUR)).toBe(pausedAt);
  });

  it('resumes from the frozen time, not from where real time has moved to', () => {
    const pausedAt = T0 + 20 * SECOND;
    const paused = withPaused(createLiveClock(T0), true, pausedAt);
    const resumeAt = pausedAt + 5 * 60 * SECOND;
    const resumed = withPaused(paused, false, resumeAt);

    expect(resumed.paused).toBe(false);
    expect(currentSimMs(resumed, resumeAt)).toBe(pausedAt);
    expect(currentSimMs(resumed, resumeAt + 7 * SECOND)).toBe(pausedAt + 7 * SECOND);
  });

  it('freezes at the fast-forwarded position when paused during fast playback', () => {
    const fast = withRate(createLiveClock(T0), 60, T0);
    const pausedAt = T0 + 10 * SECOND;
    const paused = withPaused(fast, true, pausedAt);
    expect(currentSimMs(paused, pausedAt + HOUR)).toBe(T0 + 600 * SECOND);
  });

  it('is never live while paused, even right after pausing', () => {
    const paused = withPaused(createLiveClock(T0), true, T0);
    expect(isLive(paused, T0)).toBe(false);
  });
});

describe('scrubbedTo', () => {
  it('jumps sim time to the requested instant', () => {
    const target = T0 + 3 * HOUR;
    const scrubbed = scrubbedTo(createLiveClock(T0), target, T0 + 5 * SECOND);
    expect(currentSimMs(scrubbed, T0 + 5 * SECOND)).toBe(target);
    expect(currentSimMs(scrubbed, T0 + 8 * SECOND)).toBe(target + 3 * SECOND);
  });

  it('clamps to 12 hours ahead', () => {
    const scrubbed = scrubbedTo(createLiveClock(T0), T0 + 20 * HOUR, T0);
    expect(currentSimMs(scrubbed, T0)).toBe(T0 + 12 * HOUR);
    expect(scrubbed.anchorSimMs).toBe(T0 + 12 * HOUR);
  });

  it('clamps to 12 hours behind', () => {
    const scrubbed = scrubbedTo(createLiveClock(T0), T0 - 20 * HOUR, T0);
    expect(currentSimMs(scrubbed, T0)).toBe(T0 - 12 * HOUR);
    expect(scrubbed.anchorSimMs).toBe(T0 - 12 * HOUR);
  });

  it('accepts the exact window edges', () => {
    expect(scrubbedTo(createLiveClock(T0), T0 + SIM_WINDOW_MS, T0).anchorSimMs).toBe(T0 + SIM_WINDOW_MS);
    expect(scrubbedTo(createLiveClock(T0), T0 - SIM_WINDOW_MS, T0).anchorSimMs).toBe(T0 - SIM_WINDOW_MS);
  });

  it('keeps the playback rate and paused state', () => {
    const fast = withRate(createLiveClock(T0), 60, T0);
    expect(scrubbedTo(fast, T0 + HOUR, T0).rate).toBe(60);

    const paused = withPaused(createLiveClock(T0), true, T0);
    const scrubbed = scrubbedTo(paused, T0 + HOUR, T0 + 30 * SECOND);
    expect(scrubbed.paused).toBe(true);
    expect(currentSimMs(scrubbed, T0 + 99 * SECOND)).toBe(T0 + HOUR);
  });

  it('does not mutate the original clock', () => {
    const live = createLiveClock(T0);
    scrubbedTo(live, T0 + HOUR, T0);
    expect(live.anchorSimMs).toBe(T0);
  });
});

describe('currentSimMs clamping', () => {
  it('stops fast playback at 12 hours ahead of real time', () => {
    const fast = withRate(createLiveClock(T0), 600, T0);
    // 600x for 1 minute is 10 hours: still inside the window.
    expect(currentSimMs(fast, T0 + 60 * SECOND)).toBe(T0 + 10 * HOUR);
    // 600x for 2 minutes would be 20 hours: pinned 12 hours ahead of real time.
    expect(currentSimMs(fast, T0 + 120 * SECOND)).toBe(T0 + 120 * SECOND + SIM_WINDOW_MS);
  });

  it('lets real time catch up with a clock pinned ahead', () => {
    const fast = withRate(createLiveClock(T0), 600, T0);
    const pinned = withRate(fast, 1, T0 + HOUR);
    expect(currentSimMs(pinned, T0 + HOUR)).toBe(T0 + HOUR + SIM_WINDOW_MS);
    expect(currentSimMs(pinned, T0 + HOUR + 10 * SECOND)).toBe(T0 + HOUR + 10 * SECOND + SIM_WINDOW_MS);
  });

  it('slides the lower bound forward when paused at the far past', () => {
    const paused = withPaused(scrubbedTo(createLiveClock(T0), T0 - SIM_WINDOW_MS, T0), true, T0);
    expect(currentSimMs(paused, T0)).toBe(T0 - SIM_WINDOW_MS);
    // An hour later the window has moved, so the frozen time is clamped up to its new lower edge.
    expect(currentSimMs(paused, T0 + HOUR)).toBe(T0 + HOUR - SIM_WINDOW_MS);
  });

  it('never leaves the window whatever the real time offset', () => {
    const fast = withRate(createLiveClock(T0), 600, T0);
    for (const elapsed of [0, SECOND, 30 * SECOND, 5 * 60 * SECOND, HOUR, 48 * HOUR]) {
      const sim = currentSimMs(fast, T0 + elapsed);
      expect(sim).toBeLessThanOrEqual(T0 + elapsed + SIM_WINDOW_MS);
      expect(sim).toBeGreaterThanOrEqual(T0 + elapsed - SIM_WINDOW_MS);
    }
  });
});

describe('isLive', () => {
  it('allows up to the tolerance either side of real time', () => {
    const ahead = scrubbedTo(createLiveClock(T0), T0 + LIVE_TOLERANCE_MS, T0);
    const behind = scrubbedTo(createLiveClock(T0), T0 - LIVE_TOLERANCE_MS, T0);
    expect(isLive(ahead, T0)).toBe(true);
    expect(isLive(behind, T0)).toBe(true);
  });

  it('is not live just beyond the tolerance', () => {
    const ahead = scrubbedTo(createLiveClock(T0), T0 + LIVE_TOLERANCE_MS + 1, T0);
    const behind = scrubbedTo(createLiveClock(T0), T0 - LIVE_TOLERANCE_MS - 1, T0);
    expect(isLive(ahead, T0)).toBe(false);
    expect(isLive(behind, T0)).toBe(false);
  });

  it('is not live while time-travelling', () => {
    expect(isLive(scrubbedTo(createLiveClock(T0), T0 + HOUR, T0), T0)).toBe(false);
    expect(isLive(scrubbedTo(createLiveClock(T0), T0 - 3 * HOUR, T0), T0)).toBe(false);
  });

  it('is not live at fast playback, even at the instant of switching', () => {
    expect(isLive(withRate(createLiveClock(T0), 60, T0), T0)).toBe(false);
    expect(isLive(withRate(createLiveClock(T0), 600, T0), T0)).toBe(false);
  });

  it('is not live once a paused clock drifts behind real time', () => {
    const paused = withPaused(createLiveClock(T0), true, T0);
    expect(isLive(paused, T0 + 10 * SECOND)).toBe(false);
  });

  it('is live again after scrubbing back to now at 1x', () => {
    const away = scrubbedTo(createLiveClock(T0), T0 + 2 * HOUR, T0);
    const backAt = T0 + 40 * SECOND;
    expect(isLive(away, backAt)).toBe(false);
    expect(isLive(scrubbedTo(away, backAt, backAt), backAt)).toBe(true);
  });

  it('stays not live when 1x playback trails real time, because the offset never closes', () => {
    const behind = scrubbedTo(createLiveClock(T0), T0 - 5 * SECOND, T0);
    expect(isLive(behind, T0)).toBe(false);
    expect(isLive(behind, T0 + HOUR)).toBe(false);
  });
});
