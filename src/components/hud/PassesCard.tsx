import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import clsx from 'clsx';

import { Card, IconEye, IconMapPin, IconRefresh, IconSparkle } from '@/components/kit';
import { formatClock, formatCountdown, formatDay } from '@/lib/format/units';
import { usePasses } from '@/lib/hooks/usePasses';
import { useRetry } from '@/lib/hooks/useRetry';
import type { Pass } from '@/lib/orbit/passes';
import type { SatRec } from '@/lib/orbit/types';
import { useTrackerStore } from '@/lib/state/tracker-store';

import { LocationPicker } from './LocationPicker';
import { PassItem } from './PassItem';

export interface PassesCardProps {
  satrec: SatRec | null;
  /** True once the orbit data has finished loading and there is still no usable ISS orbit. */
  orbitFailed?: boolean;
  /** Fetches the orbit data again; the "Try again" button only appears when this is given. */
  onRetryOrbit?: () => Promise<unknown>;
  className?: string;
}

const NO_RETRY = (): Promise<unknown> => Promise.resolve();

const SHOWN_PASSES = 6;
/** usePasses searches with the findPasses defaults, so these describe how far the search reached. */
const SEARCH_HOURS = 72;
const SEARCH_PASS_CAP = 12;
const MS_PER_HOUR = 3_600_000;
/** Long enough for the deferred search to finish on a slow phone before we call it a failure. */
const FAILURE_GRACE_MS = 8_000;

const clockToMinute = (date: Date): string => formatClock(date).slice(0, 5);

/** Real clock, not sim time: a pass is a real-world event, so scrubbing the globe must not move it. */
function useRealNow(enabled: boolean): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return nowMs;
}

/** True once `active` has stayed true for `ms`; resets whenever it turns false. */
function useElapsed(active: boolean, ms: number): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    setElapsed(false);
    if (!active) return;
    const timer = window.setTimeout(() => setElapsed(true), ms);
    return () => window.clearTimeout(timer);
  }, [active, ms]);
  return elapsed;
}

/** The pass cap can cut the search short of three days, so the "nothing found" note says how far it looked. */
function describeSearchSpan(passes: readonly Pass[], computedAt: Date): string {
  const last = passes[passes.length - 1];
  const reachedMs =
    passes.length >= SEARCH_PASS_CAP && last ? last.end.time.getTime() - computedAt.getTime() : Infinity;
  const hours = Math.max(1, Math.floor(Math.min(SEARCH_HOURS * MS_PER_HOUR, reachedMs) / MS_PER_HOUR));
  return hours >= 48 ? `${Math.floor(hours / 24)} days` : `${hours} hours`;
}

function PassSkeleton({ message }: { message: string }) {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        {message}
      </p>
      <div className="space-y-2.5" aria-hidden="true">
        <div className="toy-skeleton h-28 w-full" />
        <div className="toy-skeleton h-28 w-full" />
        <div className="toy-skeleton h-28 w-full opacity-60" />
      </div>
    </div>
  );
}

/** Without an orbit there is nothing to predict, so say so instead of leaving a skeleton shimmering. */
function OrbitUnavailable({ onRetry, retrying }: { onRetry: (() => void) | null; retrying: boolean }) {
  return (
    <div role="status" className="rounded-2xl border-2 border-blush bg-peach/50 px-3 py-3">
      <p className="m-0 text-sm font-bold text-ink">Passes unavailable</p>
      <p className="m-0 mt-1 text-xs font-semibold text-ink">
        We could not load the latest ISS orbit data, so we cannot work out the passes yet.
      </p>
      {onRetry ? (
        <button type="button" className="toy-btn toy-btn-sm mt-3" disabled={retrying} onClick={onRetry}>
          <IconRefresh className="h-3.5 w-3.5" />
          {retrying ? 'Trying again' : 'Try again'}
        </button>
      ) : null}
    </div>
  );
}

function Note({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'warm' }) {
  return (
    <p
      className={clsx(
        'm-0 mb-3 rounded-2xl border-2 px-3 py-2.5 text-sm font-semibold text-ink',
        tone === 'warm' ? 'border-butter-deep bg-butter/40' : 'border-line bg-cream/70',
      )}
    >
      {children}
    </p>
  );
}

/** Says when the next naked-eye pass is, even when it is further off than the six listed below. */
function NextVisibleNote({ pass, nowMs }: { pass: Pass; nowMs: number }) {
  const startMs = pass.start.time.getTime();
  const underway = startMs <= nowMs;
  return (
    <Note tone="warm">
      <IconSparkle className="mr-1.5 inline h-4 w-4 align-text-bottom" />
      Next pass you can see:{' '}
      <strong className="font-extrabold">
        {underway ? 'happening now' : `${formatDay(pass.start.time)}, ${clockToMinute(pass.start.time)}`}
      </strong>
      {underway ? null : ` (${formatCountdown(startMs - nowMs)})`}
    </Note>
  );
}

interface PassResultsProps {
  passes: readonly Pass[];
  computedAt: Date;
  computing: boolean;
  nowMs: number;
}

function PassResults({ passes, computedAt, computing, nowMs }: PassResultsProps) {
  const timeZone = useMemo(() => new Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  // A pass that has finished stays in the cache until the next refresh, so it is filtered out live.
  const upcoming = useMemo(() => passes.filter((pass) => pass.end.time.getTime() > nowMs), [passes, nowMs]);
  const nextVisible = upcoming.find((pass) => pass.visible);
  const span = describeSearchSpan(passes, computedAt);

  return (
    <>
      {passes.length === 0 ? (
        <Note>
          The ISS does not climb above 10° from here in the next {span}. Close to the poles it may never
          come into view.
        </Note>
      ) : nextVisible ? (
        <NextVisibleNote pass={nextVisible} nowMs={nowMs} />
      ) : (
        <Note>
          No passes you can see with your eyes in the next {span}. The ISS still flies over, but each
          pass is in daylight or while it is in Earth&rsquo;s shadow. Check back later: the ISS orbit
          slowly shifts against the Sun, so good evenings and mornings come round again.
        </Note>
      )}
      {upcoming.length > 0 ? (
        <ul className="m-0 list-none space-y-2.5 p-0" aria-busy={computing}>
          {upcoming.slice(0, SHOWN_PASSES).map((pass) => (
            <PassItem key={pass.id} pass={pass} nowMs={nowMs} />
          ))}
        </ul>
      ) : null}
      {passes.length > 0 ? (
        <p className="m-0 mt-3 text-xs font-semibold text-ink-soft">
          Times use your device&rsquo;s time zone{timeZone ? ` (${timeZone})` : ''}. &ldquo;Visible
          ✨&rdquo; means it is dark where you are while the ISS is high up and still lit by the Sun:
          look for a bright, steady light gliding across the sky.
        </p>
      ) : null}
    </>
  );
}

/** "When can I see it?": upcoming passes for the chosen place, with the naked-eye ones picked out. */
export function PassesCard({ satrec, orbitFailed = false, onRetryOrbit, className }: PassesCardProps) {
  const observer = useTrackerStore((state) => state.observer);
  const { passes, computing, computedAt } = usePasses(satrec, observer);
  const { retry, retrying } = useRetry(onRetryOrbit ?? NO_RETRY);
  // `retrying` keeps the message up while a retry runs, because the query clears its error when it starts.
  const orbitUnavailable = satrec === null && (orbitFailed || retrying);

  const [changing, setChanging] = useState(false);
  const nowMs = useRealNow(observer !== null);

  const locationRef = useRef<HTMLParagraphElement>(null);
  const lastObserver = useRef(observer);
  const focusPending = useRef(false);

  const handleSelected = (): void => setChanging(false);

  // A chosen place replaces the picker, so focus moves to the new heading instead of vanishing.
  // Driven by the store, not the click: a geolocation reply can land after the picker is gone.
  useEffect(() => {
    if (lastObserver.current !== observer) {
      lastObserver.current = observer;
      focusPending.current = observer !== null;
    }
    if (focusPending.current && !changing && observer) {
      focusPending.current = false;
      locationRef.current?.focus();
    }
  }, [observer, changing]);

  const waiting = satrec !== null && observer !== null && !changing && computedAt === null;
  const failed = useElapsed(waiting, FAILURE_GRACE_MS) && !computing;

  let body: ReactNode;
  if (!observer) {
    body = (
      <>
        <div className="mb-4 flex items-start gap-3">
          <span
            className="grid h-12 w-12 shrink-0 animate-bob place-items-center rounded-2xl bg-sky text-2xl"
            aria-hidden="true"
          >
            🔭
          </span>
          <p className="m-0 text-sm font-semibold text-ink">
            Tell me where you are and I will tell you when the ISS flies over, and which passes you can
            spot with your own eyes.
          </p>
        </div>
        <LocationPicker onSelected={handleSelected} />
      </>
    );
  } else if (changing) {
    body = <LocationPicker onSelected={handleSelected} focusOnMount />;
  } else if (orbitUnavailable) {
    body = <OrbitUnavailable onRetry={onRetryOrbit ? retry : null} retrying={retrying} />;
  } else if (computedAt !== null) {
    body = <PassResults passes={passes} computedAt={computedAt} computing={computing} nowMs={nowMs} />;
  } else if (failed) {
    body = (
      <Note tone="warm">
        Something went wrong working out the passes. Pick your place again to retry, or reload the page.
      </Note>
    );
  } else {
    body = (
      <PassSkeleton
        message={satrec ? 'Working out when the ISS passes over you.' : 'Waiting for the latest ISS orbit data.'}
      />
    );
  }

  return (
    <Card title="When can I see it?" icon={<IconEye className="h-5 w-5" />} className={className}>
      {observer ? (
        <div className="mb-3 flex items-center gap-2">
          <p
            ref={locationRef}
            tabIndex={-1}
            className="m-0 min-w-0 flex-1 break-words text-sm font-bold text-ink-soft"
            title={observer.label}
          >
            Passes over <span className="text-ink">{observer.label}</span>
          </p>
          <button
            type="button"
            className="toy-btn toy-btn-sm shrink-0"
            aria-expanded={changing}
            onClick={() => setChanging((value) => !value)}
          >
            <IconMapPin className="h-3.5 w-3.5" />
            {changing ? 'Cancel' : 'Change'}
          </button>
        </div>
      ) : null}
      {body}
    </Card>
  );
}
