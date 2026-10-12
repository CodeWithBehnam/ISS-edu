import { useMemo } from 'react';

import { Pill } from '@/components/kit';
import type { LiveTelemetry } from '@/lib/api/iss-telemetry';
import { subsolarPoint } from '@/lib/astro/sun';
import { formatLatitude, formatLongitude } from '@/lib/format/units';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  countriesPath,
  nightPolygon,
  pointsAttribute,
  projectPoint,
  trackPath,
} from '@/lib/geo/flat-map';
import { useIssState } from '@/lib/hooks/useIssState';
import { useCountries } from '@/lib/hooks/useRegion';
import { useSimNow } from '@/lib/hooks/useSimNow';
import { sampleOrbit } from '@/lib/orbit/satrec';
import type { GeoPoint, SatRec } from '@/lib/orbit/types';
import { useTrackerStore } from '@/lib/state/tracker-store';

/** The ISS never rises above this latitude, which makes it a handy teaching line. */
const ISS_INCLINATION_DEG = 51.6;
const TRACK_STEP_SECONDS = 30;
const TRACK_BUCKET_MS = TRACK_STEP_SECONDS * 1000;
const TRACK_PAST_MS = 45 * 60_000;
const TRACK_FUTURE_MS = 95 * 60_000;
const NIGHT_BUCKET_MS = 60_000;
/** Map units from the right edge inside which the ISS label flips to the left of its dot. */
const LABEL_FLIP_MARGIN = 32;

const GRATICULE = [
  ...Array.from({ length: MAP_WIDTH / 30 + 1 }, (_, i) => `M${i * 30} 0V${MAP_HEIGHT}`),
  ...Array.from({ length: MAP_HEIGHT / 30 + 1 }, (_, i) => `M0 ${i * 30}H${MAP_WIDTH}`),
].join('');

export interface FlatMapFallbackProps {
  satrec: SatRec | null;
  fallbackTelemetry: LiveTelemetry | null;
}

export function FlatMapFallback({ satrec, fallbackTelemetry }: FlatMapFallbackProps) {
  const simNow = useSimNow(1);
  const state = useIssState(satrec, 1);
  const { data: countries } = useCountries();
  const observer = useTrackerStore((store) => store.observer);

  const land = useMemo(() => (countries ? countriesPath(countries) : ''), [countries]);

  const trackBucket = Math.floor(simNow.getTime() / TRACK_BUCKET_MS);
  const track = useMemo(() => {
    if (!satrec) return { past: '', future: '' };
    const centreMs = trackBucket * TRACK_BUCKET_MS;
    const samples = sampleOrbit(
      satrec,
      new Date(centreMs - TRACK_PAST_MS),
      new Date(centreMs + TRACK_FUTURE_MS),
      TRACK_STEP_SECONDS,
    );
    return {
      past: trackPath(samples.filter((sample) => sample.time.getTime() <= centreMs)),
      future: trackPath(samples.filter((sample) => sample.time.getTime() >= centreMs)),
    };
  }, [satrec, trackBucket]);

  const nightBucket = Math.floor(simNow.getTime() / NIGHT_BUCKET_MS);
  const night = useMemo(
    () => pointsAttribute(nightPolygon(subsolarPoint(new Date(nightBucket * NIGHT_BUCKET_MS)))),
    [nightBucket],
  );

  const position: GeoPoint | null =
    state ??
    (fallbackTelemetry
      ? { latitude: fallbackTelemetry.latitude, longitude: fallbackTelemetry.longitude }
      : null);
  const marker = position ? projectPoint(position) : null;
  const observerMarker = observer ? projectPoint(observer) : null;
  const labelBeforeDot = marker !== null && marker[0] > MAP_WIDTH - LABEL_FLIP_MARGIN;
  const issDescription = position
    ? `The International Space Station is at ${formatLatitude(position.latitude)}, ${formatLongitude(position.longitude)}.`
    : 'Waiting for the position of the International Space Station.';
  const description = `Flat map of Earth. ${issDescription}${observer ? ` Your chosen place, ${observer.label}, is marked with a purple dot.` : ''}`;
  const tropicNorth = 90 - ISS_INCLINATION_DEG;
  const tropicSouth = 90 + ISS_INCLINATION_DEG;

  return (
    <div className="grid h-full w-full place-items-center px-4 pb-4 pt-6 lg:px-[calc(var(--hud-col)_+_1.5rem)]">
      <figure className="m-0 flex w-full max-w-4xl flex-col items-center gap-3">
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          role="img"
          aria-label={description}
          className="block w-full overflow-hidden rounded-[28px] border-2 border-line bg-sky shadow-toy"
        >
          <path
            d={GRATICULE}
            className="fill-none stroke-paper/70"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {land ? (
            <path
              d={land}
              fillRule="evenodd"
              className="fill-mint stroke-leaf"
              strokeWidth={1}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          <polygon points={night} className="fill-night" opacity={0.28} />

          {/* Dashed lines show the northern and southern limits of the ISS orbit. */}
          <path
            d={`M0 ${tropicNorth}H${MAP_WIDTH}M0 ${tropicSouth}H${MAP_WIDTH}`}
            className="fill-none stroke-ink-soft"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.45}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={track.past}
            className="fill-none stroke-ink-soft"
            strokeWidth={2}
            opacity={0.5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={track.future}
            className="fill-none stroke-coral-deep"
            strokeWidth={2.5}
            strokeDasharray="1 6"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {observerMarker ? (
            <g transform={`translate(${observerMarker[0]} ${observerMarker[1]})`}>
              <circle r={5.5} className="fill-none stroke-grape" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <circle r={2.6} className="fill-grape stroke-paper" strokeWidth={1.2} />
            </g>
          ) : null}

          {marker ? (
            <g transform={`translate(${marker[0]} ${marker[1]})`}>
              <circle
                r={4}
                className="origin-center animate-ping-soft fill-coral/40 [transform-box:fill-box]"
              />
              <circle r={3} className="fill-coral stroke-paper" strokeWidth={1.2} />
              <text
                x={labelBeforeDot ? -5.5 : 5.5}
                y={-4.5}
                textAnchor={labelBeforeDot ? 'end' : 'start'}
                className="fill-ink font-display text-[9px] font-bold"
                stroke="#FFFDF8"
                strokeWidth={1.8}
                paintOrder="stroke"
              >
                ISS
              </text>
            </g>
          ) : null}
        </svg>
        <figcaption className="flex flex-col items-center gap-1.5 text-center text-sm font-semibold text-ink-soft">
          <span className="flex flex-wrap items-center justify-center gap-2">
            <Pill tone="info">Flat map mode</Pill>
            The 3D globe is not available here, so this is the ground track instead.
          </span>
          <span>
            The dashed lines mark the furthest north and south the ISS ever travels ({ISS_INCLINATION_DEG}°).
          </span>
          {observer ? (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-grape" />
              Purple dot: {observer.label}
            </span>
          ) : null}
        </figcaption>
      </figure>
    </div>
  );
}
