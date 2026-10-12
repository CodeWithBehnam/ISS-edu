import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { Card, IconSatellite, IconSparkle, Pill, StatTile } from '@/components/kit';
import type { LiveTelemetry } from '@/lib/api/iss-telemetry';
import { describeDrift, greatCircleKm, pickReading, splitUnit } from '@/lib/format/telemetry';
import {
  formatAltitude,
  formatCountdown,
  formatDistance,
  formatLatitude,
  formatLongitude,
  formatSpeed,
} from '@/lib/format/units';
import { useIssState } from '@/lib/hooks/useIssState';
import { useIsLive } from '@/lib/hooks/useSimNow';
import { clientLog } from '@/lib/observability/client-log';
import { orbitalPeriodMinutes, propagateState, revolutionNumberAt, tleEpoch } from '@/lib/orbit/satrec';
import type { SatRec, TleRecord } from '@/lib/orbit/types';
import { useTrackerStore } from '@/lib/state/tracker-store';

/** A feed older than this is not a fair yardstick for the SGP4 position. */
const FRESH_TELEMETRY_MS = 60_000;
const MINUTES_PER_DAY = 24 * 60;

const integerFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Revolution counting depends on TLE column layout; a bad line must not take the whole card down. */
function safeRevolution(satrec: SatRec, line2: string, time: Date): number | null {
  try {
    return revolutionNumberAt(satrec, line2, time);
  } catch (error) {
    clientLog('warn', 'revolution-failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-sm font-bold text-ink-soft">{label}</dt>
      <dd className="m-0 text-right font-mono text-sm font-bold tabular-nums text-ink">{children}</dd>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-2.5" aria-busy="true">
      <p className="sr-only">Tuning in to the station…</p>
      <div className="toy-skeleton h-24" />
      <div className="grid grid-cols-2 gap-2.5">
        <div className="toy-skeleton h-16" />
        <div className="toy-skeleton h-16" />
      </div>
      <div className="toy-skeleton h-24" />
    </div>
  );
}

export interface TelemetryCardProps {
  satrec: SatRec | null;
  tle: TleRecord | null;
  telemetry: LiveTelemetry | null;
  loading: boolean;
}

export function TelemetryCard({ satrec, tle, telemetry, loading }: TelemetryCardProps) {
  const units = useTrackerStore((state) => state.units);
  const live = useIsLive();
  // Four updates a second: fast enough to feel alive, slow enough for the digits to be readable.
  const state = useIssState(satrec, 4);
  const reading = pickReading(state, telemetry);

  const periodMinutes = useMemo(() => (satrec ? orbitalPeriodMinutes(satrec) : null), [satrec]);
  const drift = useMemo(() => {
    if (!satrec || !telemetry) return null;
    const model = propagateState(satrec, telemetry.time);
    return model ? greatCircleKm(model, telemetry) : null;
  }, [satrec, telemetry]);

  const showDrift =
    live &&
    drift !== null &&
    telemetry !== null &&
    Date.now() - telemetry.time.getTime() < FRESH_TELEMETRY_MS;
  const revolution = satrec && tle && state ? safeRevolution(satrec, tle.line2, state.time) : null;
  const epochAge = satrec ? formatCountdown(tleEpoch(satrec).getTime() - Date.now()) : null;

  const speed = reading ? splitUnit(formatSpeed(reading.speedKps, units)) : null;
  const altitude = reading ? splitUnit(formatAltitude(reading.altitudeKm, units)) : null;

  const sourcePill = reading ? (
    <Pill tone={reading.source === 'model' ? 'info' : 'warn'}>
      {reading.source === 'model' ? 'SGP4 model' : 'Live feed'}
    </Pill>
  ) : null;

  return (
    <Card title="ISS right now" icon={<IconSatellite className="h-5 w-5" />}>
      {reading && speed && altitude ? (
        <div className="grid gap-2.5">
          <StatTile
            label="Speed"
            value={speed.value}
            unit={speed.unit}
            emphasis="hero"
            hint={`That is about ${formatDistance(reading.speedKps, units)} every second!`}
          />
          <div className="grid grid-cols-2 gap-2.5">
            <StatTile label="Altitude" value={altitude.value} unit={altitude.unit} />
            {periodMinutes !== null ? (
              <StatTile label="One lap" value={decimalFormat.format(periodMinutes)} unit="min" />
            ) : null}
          </div>
          <dl className="m-0 divide-y-2 divide-line/70 rounded-2xl border-2 border-line bg-cream/70 px-3.5 py-1">
            <Row label="Latitude">{formatLatitude(reading.latitude)}</Row>
            <Row label="Longitude">{formatLongitude(reading.longitude)}</Row>
            {revolution !== null ? <Row label="Orbit number">{integerFormat.format(revolution)}</Row> : null}
            {epochAge !== null ? (
              <Row
                label={
                  <abbr title="Two-line element set: the orbit data our maths starts from">TLE age</abbr>
                }
              >
                {epochAge}
              </Row>
            ) : null}
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <p className="m-0 text-xs font-semibold text-ink-soft">
              {periodMinutes !== null
                ? `${decimalFormat.format(MINUTES_PER_DAY / periodMinutes)} laps of Earth every day.`
                : 'Numbers come straight from the live feed.'}
            </p>
            {sourcePill}
          </div>
          {showDrift && drift !== null ? (
            <p className="m-0 flex gap-2 rounded-2xl bg-lavender/30 px-3 py-2 text-xs font-semibold text-ink">
              <IconSparkle className="mt-px h-4 w-4 shrink-0" />
              <span>{describeDrift(drift, units)}</span>
            </p>
          ) : null}
        </div>
      ) : loading ? (
        <Skeleton />
      ) : (
        <p className="m-0 text-sm font-semibold text-ink-soft" role="status">
          We cannot reach the station feeds right now. This page keeps trying every few seconds.
        </p>
      )}
    </Card>
  );
}
