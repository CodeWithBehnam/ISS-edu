import { useId, useRef } from 'react';
import clsx from 'clsx';

import {
  IconButton,
  IconClock,
  IconPause,
  IconPlay,
  IconRefresh,
  Pill,
  SegmentedControl,
} from '@/components/kit';
import type { SegmentedOption } from '@/components/kit';
import { formatClock, formatDay } from '@/lib/format/units';
import { useIsLive, useSimNow } from '@/lib/hooks/useSimNow';
import { useTrackerStore } from '@/lib/state/tracker-store';
import { MAX_OFFSET_MINUTES, describeOffset, formatOffset, offsetMinutes } from '@/lib/time/offset';
import type { PlaybackRate } from '@/lib/time/sim-clock';

const MINUTE_MS = 60_000;

/**
 * The shared range style draws a pale track that nearly vanishes on a paper card, so tint it:
 * lavender for the past, sky around now, peach for the future. Both engines need their own selector.
 */
const TRACK_TINT = [
  '[&::-webkit-slider-runnable-track]:bg-gradient-to-r',
  '[&::-webkit-slider-runnable-track]:from-lavender [&::-webkit-slider-runnable-track]:via-sky [&::-webkit-slider-runnable-track]:to-peach',
  '[&::-moz-range-track]:bg-gradient-to-r',
  '[&::-moz-range-track]:from-lavender [&::-moz-range-track]:via-sky [&::-moz-range-track]:to-peach',
].join(' ');

type RateKey = `${PlaybackRate}`;

const RATE_OPTIONS: readonly SegmentedOption<RateKey>[] = [
  { value: '1', label: '1×' },
  { value: '60', label: '60×' },
  { value: '600', label: '600×' },
];

/** Exhaustive over RateKey, so adding a playback rate fails to compile until it is mapped here. */
function parseRate(key: RateKey): PlaybackRate {
  switch (key) {
    case '1':
      return 1;
    case '60':
      return 60;
    case '600':
      return 600;
  }
}

export interface TimeScrubberProps {
  className?: string;
}

export function TimeScrubber({ className }: TimeScrubberProps) {
  const sliderId = useId();
  const sliderRef = useRef<HTMLInputElement>(null);
  const now = useSimNow(4);
  const live = useIsLive();
  const rate = useTrackerStore((state) => state.clock.rate);
  const paused = useTrackerStore((state) => state.clock.paused);
  const scrubTo = useTrackerStore((state) => state.scrubTo);
  const setRate = useTrackerStore((state) => state.setRate);
  const setPaused = useTrackerStore((state) => state.setPaused);
  const goLive = useTrackerStore((state) => state.goLive);

  const minutes = offsetMinutes(now.getTime(), Date.now());
  const rateKey: RateKey = `${rate}`;
  const localDay = formatDay(now);
  const localClock = formatClock(now);

  const handleBackToLive = (): void => {
    goLive();
    // The button unmounts once the clock is live; keep keyboard users where they were.
    sliderRef.current?.focus();
  };

  return (
    <section
      aria-label="Time controls"
      className={clsx('toy-card flex flex-col gap-2 rounded-3xl p-2.5 sm:gap-2.5 sm:p-3 sm:px-4', className)}
    >
      <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1">
        <label htmlFor={sliderId} className="flex items-center gap-2 font-display text-base font-semibold">
          <IconClock className="h-5 w-5" />
          Time travel
          <span className="hidden text-xs font-bold text-ink-soft sm:inline">(±12 h)</span>
        </label>
        <p className="m-0 flex items-center gap-2">
          {/* Phones keep the clock and the offset on one line; the day and the zone note come back from 640 px. */}
          <span className="font-mono text-sm font-bold tabular-nums">
            <span className="hidden sm:inline">{localDay} · </span>
            {localClock}
          </span>
          <span className="hidden text-xs font-bold text-ink-soft sm:inline">your time</span>
          <Pill tone={minutes === 0 ? 'neutral' : 'info'} className="font-mono tabular-nums">
            {formatOffset(minutes)}
          </Pill>
        </p>
        {live ? null : (
          <button
            type="button"
            className="toy-btn toy-btn-coral toy-btn-sm ml-auto"
            onClick={handleBackToLive}
          >
            <IconRefresh className="h-4 w-4" />
            Back to live
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <IconButton
          label={paused ? 'Play' : 'Pause'}
          size="sm"
          variant="sky"
          onClick={() => setPaused(!paused)}
        >
          {paused ? <IconPlay className="h-5 w-5" /> : <IconPause className="h-5 w-5" />}
        </IconButton>
        <SegmentedControl
          options={RATE_OPTIONS}
          value={rateKey}
          onChange={(key) => setRate(parseRate(key))}
          ariaLabel="Playback speed"
          className="[&>button]:px-2.5 [&>button]:font-mono"
        />
        <div className="relative min-w-0 basis-full sm:basis-40 sm:flex-1">
          {/* Notch marks "now" in the middle of the track; the track itself is drawn over its centre. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-ink/25"
          />
          <input
            ref={sliderRef}
            id={sliderId}
            type="range"
            className={clsx('toy-range relative', TRACK_TINT)}
            min={-MAX_OFFSET_MINUTES}
            max={MAX_OFFSET_MINUTES}
            step={1}
            value={minutes}
            aria-valuetext={`${describeOffset(minutes)}, ${localDay} ${localClock.slice(0, 5)} your time`}
            onChange={(event) => scrubTo(Date.now() + Number(event.currentTarget.value) * MINUTE_MS)}
          />
        </div>
      </div>
    </section>
  );
}
