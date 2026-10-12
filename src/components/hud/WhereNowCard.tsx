import { useMemo } from 'react';

import { Card, IconMapPin, IconMoon, IconRefresh, IconSparkle, IconSun, Pill } from '@/components/kit';
import type { LiveTelemetry } from '@/lib/api/iss-telemetry';
import { formatDistance, formatLatitude, formatLongitude } from '@/lib/format/units';
import { describeTransition, horizonDiameterKm, placeWithArticle } from '@/lib/format/where-now';
import { useIssRegion } from '@/lib/hooks/useIssRegion';
import { useCountries } from '@/lib/hooks/useRegion';
import { useRetry } from '@/lib/hooks/useRetry';
import { useSimNow } from '@/lib/hooks/useSimNow';
import { useSunlight } from '@/lib/hooks/useSunlight';
import { orbitalPeriodMinutes } from '@/lib/orbit/satrec';
import type { SatRec } from '@/lib/orbit/types';
import { useTrackerStore } from '@/lib/state/tracker-store';

const MINUTES_PER_DAY = 24 * 60;

export interface WhereNowCardProps {
  satrec: SatRec | null;
  telemetry: LiveTelemetry | null;
}

export function WhereNowCard({ satrec, telemetry }: WhereNowCardProps) {
  const units = useTrackerStore((store) => store.units);
  const now = useSimNow(1);
  const { state, region } = useIssRegion(satrec, telemetry);
  const sunlight = useSunlight(satrec);
  const countries = useCountries();
  const { retry, retrying } = useRetry(countries.refetch);

  // The live feed's own day/night flag covers the case where no TLE could be loaded.
  const sunlit = sunlight.sunlit ?? (telemetry ? telemetry.visibility === 'daylight' : null);
  const altitudeKm = state?.altitudeKm ?? telemetry?.altitudeKm ?? null;
  const periodMinutes = useMemo(() => (satrec ? orbitalPeriodMinutes(satrec) : null), [satrec]);
  const transition = sunlight.next ? describeTransition(sunlight.next, now.getTime()) : null;

  // Without the country map there is no name to give, but the position is still known.
  const position = state ?? telemetry;
  const mapFailed = region === null && position !== null && (countries.isError || retrying);

  return (
    <Card title="Where is it now?" icon={<IconMapPin className="h-5 w-5" />}>
      <div className="min-h-[2.25rem]">
        {region ? (
          <p className="m-0 text-balance font-display text-2xl font-semibold leading-snug">
            Over{' '}
            {region.kind === 'country' && region.flag ? <span aria-hidden="true">{region.flag} </span> : null}
            {placeWithArticle(region)}
          </p>
        ) : mapFailed ? (
          <div role="status">
            <p className="m-0 text-balance font-display text-2xl font-semibold leading-snug">
              Over {formatLatitude(position.latitude)}, {formatLongitude(position.longitude)}
            </p>
            <p className="m-0 mt-1 text-xs font-semibold text-ink-soft">
              The country map did not load, so these are the coordinates instead.
            </p>
            <button type="button" className="toy-btn toy-btn-sm mt-2" disabled={retrying} onClick={retry}>
              <IconRefresh className="h-3.5 w-3.5" />
              {retrying ? 'Trying again' : 'Try again'}
            </button>
          </div>
        ) : (
          <div className="grid gap-2" aria-busy="true">
            <p className="sr-only">Looking down at the map…</p>
            <div className="toy-skeleton h-7 w-4/5" />
            <div className="toy-skeleton h-7 w-1/2" />
          </div>
        )}
      </div>

      {sunlit !== null ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <Pill tone={sunlit ? 'day' : 'night'}>
            {sunlit ? <IconSun className="h-3.5 w-3.5" /> : <IconMoon className="h-3.5 w-3.5" />}
            {sunlit ? 'In sunlight' : "In Earth's shadow"}
          </Pill>
          {transition ? <span className="text-sm font-semibold text-ink-soft">{transition}</span> : null}
        </div>
      ) : null}

      {altitudeKm !== null ? (
        <p className="mb-0 mt-3 text-sm font-semibold text-ink-soft">
          From up there the crew can see about{' '}
          <span className="font-mono font-bold tabular-nums text-ink">
            {formatDistance(horizonDiameterKm(altitudeKm), units)}
          </span>{' '}
          across.
        </p>
      ) : null}

      {periodMinutes !== null ? (
        <p className="mb-0 mt-3 flex gap-2 rounded-2xl bg-butter/50 px-3 py-2 text-xs font-semibold text-ink">
          <IconSparkle className="mt-px h-4 w-4 shrink-0" />
          <span>
            Fun fact: a lap takes about {Math.round(periodMinutes)} minutes, so the crew can watch up to{' '}
            {Math.ceil(MINUTES_PER_DAY / periodMinutes)} sunrises every day.
          </span>
        </p>
      ) : null}
    </Card>
  );
}
