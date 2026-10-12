import clsx from 'clsx';

import { IconSatellite, Pill, SegmentedControl } from '@/components/kit';
import type { SegmentedOption } from '@/components/kit';
import { describeTimeStatus } from '@/components/hud/time-status';
import { formatClock } from '@/lib/format/units';
import { useIsLive, useSimNow } from '@/lib/hooks/useSimNow';
import { useTrackerStore } from '@/lib/state/tracker-store';
import type { Units } from '@/lib/state/tracker-store';

const UNIT_OPTIONS: readonly SegmentedOption<Units>[] = [
  { value: 'metric', label: 'km' },
  { value: 'imperial', label: 'mi' },
];

export interface TopBarProps {
  className?: string;
}

export function TopBar({ className }: TopBarProps) {
  const units = useTrackerStore((state) => state.units);
  const setUnits = useTrackerStore((state) => state.setUnits);
  const paused = useTrackerStore((state) => state.clock.paused);
  const rate = useTrackerStore((state) => state.clock.rate);
  const live = useIsLive();
  // Four samples a second keeps the seconds from skipping when the interval drifts.
  const now = useSimNow(4);
  const status = describeTimeStatus(live, paused, rate);

  return (
    <header
      className={clsx(
        'toy-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-3xl px-3 py-2.5 sm:flex sm:px-4',
        className,
      )}
    >
      {/* On phones the brand gets a row to itself so the title is never cut short. */}
      <div className="col-span-2 flex min-w-0 items-center gap-2.5 sm:col-span-1 sm:flex-1">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border-2 border-coral-deep bg-coral text-ink shadow-[0_3px_0_#E5705D]">
          <IconSatellite className="h-6 w-6 motion-safe:animate-bob" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-semibold leading-tight sm:text-xl">
            ISS-edu
          </h1>
          <p className="truncate text-xs font-bold text-ink-soft">Live ISS tracker</p>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <Pill tone={status.tone} pulse={status.pulse}>
          {status.label}
        </Pill>
        <p className="m-0 flex items-baseline gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">UTC</span>
          <time dateTime={now.toISOString()} className="font-mono text-sm font-bold tabular-nums">
            {formatClock(now, 'UTC')}
          </time>
        </p>
      </div>

      <SegmentedControl
        options={UNIT_OPTIONS}
        value={units}
        onChange={setUnits}
        ariaLabel="Distance units"
        className="justify-self-end"
      />
    </header>
  );
}
