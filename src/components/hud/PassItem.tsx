import type { ReactNode } from 'react';
import clsx from 'clsx';

import { Pill } from '@/components/kit';
import {
  compassPoint,
  formatClock,
  formatCountdown,
  formatDay,
  formatDuration,
} from '@/lib/format/units';
import type { Pass } from '@/lib/orbit/passes';

import { SkyArc } from './SkyArc';

export interface PassItemProps {
  pass: Pass;
  /** Real time in milliseconds. One timer in the parent drives every countdown. */
  nowMs: number;
}

const QUALITY_LABEL: Record<Pass['quality'], string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

/** Pass times are shown to the minute: the rise point is only meaningful to a few seconds anyway. */
const clockToMinute = (date: Date): string => formatClock(date).slice(0, 5);

interface Timing {
  text: string;
  underway: boolean;
}

function describeTiming(pass: Pass, nowMs: number): Timing {
  const startMs = pass.start.time.getTime();
  const endMs = pass.end.time.getTime();
  if (nowMs >= startMs && nowMs < endMs) {
    return { text: `Passing now, ends ${formatCountdown(endMs - nowMs)}`, underway: true };
  }
  return { text: `Starts ${formatCountdown(startMs - nowMs)}`, underway: false };
}

interface DetailProps {
  label: string;
  children: ReactNode;
}

function Detail({ label, children }: DetailProps) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-10 shrink-0 font-semibold text-ink-soft">{label}</dt>
      <dd className="m-0 whitespace-nowrap font-mono font-bold tabular-nums text-ink">{children}</dd>
    </div>
  );
}

export function PassItem({ pass, nowMs }: PassItemProps) {
  const { start, peak, end, visible } = pass;
  const timing = describeTiming(pass, nowMs);

  return (
    <li
      className={clsx(
        'rounded-2xl border-2 p-3',
        visible ? 'border-butter-deep bg-butter/30' : 'border-line bg-cream/60',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <p className="m-0 font-display text-base font-semibold leading-tight">
          <time dateTime={start.time.toISOString()}>
            {formatDay(start.time)}, {clockToMinute(start.time)}
          </time>
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {timing.underway ? (
            <Pill tone="live" pulse>
              Now
            </Pill>
          ) : null}
          {visible ? (
            <Pill tone="day">
              Visible <span aria-hidden="true">✨</span>
            </Pill>
          ) : (
            <Pill tone="neutral">Not visible</Pill>
          )}
        </div>
      </div>

      <p className="m-0 mt-1 text-sm font-bold text-ink">{timing.text}</p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <dl className="m-0 min-w-[7.5rem] flex-1 space-y-0.5 text-xs">
          <Detail label="Peak">
            {Math.round(pass.maxElevationDeg)}° {compassPoint(peak.azimuthDeg)}
          </Detail>
          <Detail label="Lasts">{formatDuration(pass.durationSeconds)}</Detail>
          <Detail label="Path">
            {compassPoint(start.azimuthDeg)} <span aria-hidden="true">→</span>
            <span className="sr-only"> to </span> {compassPoint(end.azimuthDeg)}
          </Detail>
          <Detail label="View">{QUALITY_LABEL[pass.quality]}</Detail>
        </dl>
        <SkyArc pass={pass} decorative className="w-28" />
      </div>
    </li>
  );
}
