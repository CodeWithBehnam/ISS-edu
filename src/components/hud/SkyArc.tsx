import { memo, useId } from 'react';
import clsx from 'clsx';

import { compassPoint } from '@/lib/format/units';
import type { Pass } from '@/lib/orbit/passes';

export interface SkyArcProps {
  pass: Pick<Pass, 'start' | 'peak' | 'end' | 'visible'>;
  /** Hides the drawing from assistive technology when the same facts are written out beside it. */
  decorative?: boolean;
  className?: string;
}

const WIDTH = 144;
const HEIGHT = 80;
const DOME_LEFT = 4;
const DOME_RIGHT = WIDTH - 4;
const PLOT_LEFT = 12;
const PLOT_RIGHT = WIDTH - 12;
const HORIZON_Y = 62;
const ZENITH_Y = 6;
const LABEL_Y = 77;
/** In drawing units; the dome is shown about 112 px wide, so 13 comes out near 10 px, the smallest that reads comfortably. */
const FONT_SIZE = 13;
const GUIDE_ELEVATIONS_DEG = [30, 60] as const;
/** Narrowest slice of sky drawn, so a short pass does not look enormous. */
const MIN_HALF_WINDOW_DEG = 100;
const WINDOW_MARGIN_DEG = 25;

const CARDINALS = [
  { label: 'N', azimuthDeg: 0 },
  { label: 'E', azimuthDeg: 90 },
  { label: 'S', azimuthDeg: 180 },
  { label: 'W', azimuthDeg: 270 },
] as const;

/** Signed shortest turn from one bearing to another, in [-180, 180). */
const signedTurn = (from: number, to: number): number =>
  ((((to - from + 180) % 360) + 360) % 360) - 180;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const elevationToY = (elevationDeg: number): number =>
  HORIZON_Y - (clamp(elevationDeg, 0, 90) / 90) * (HORIZON_Y - ZENITH_Y);

const round1 = (value: number): number => Math.round(value * 10) / 10;

interface SkyLayout {
  start: { x: number; y: number };
  peak: { x: number; y: number };
  end: { x: number; y: number };
  ticks: Array<{ label: string; x: number }>;
}

/**
 * Lays the pass out as a panorama centred on the middle of its track. Azimuths are unwrapped leg by
 * leg (start to peak, peak to end), so a pass crossing north does not tear at the 0/360 seam.
 */
function layoutPass({ start, peak, end }: SkyArcProps['pass']): SkyLayout {
  const peakOffset = signedTurn(start.azimuthDeg, peak.azimuthDeg);
  const endOffset = peakOffset + signedTurn(peak.azimuthDeg, end.azimuthDeg);
  const low = Math.min(0, peakOffset, endOffset);
  const high = Math.max(0, peakOffset, endOffset);
  const middle = (low + high) / 2;
  const halfWindow = clamp(Math.max(MIN_HALF_WINDOW_DEG, (high - low) / 2 + WINDOW_MARGIN_DEG), 0, 180);

  const centreX = (PLOT_LEFT + PLOT_RIGHT) / 2;
  const pixelsPerDegree = (PLOT_RIGHT - PLOT_LEFT) / (2 * halfWindow);
  const toX = (offsetFromCentre: number): number => centreX + offsetFromCentre * pixelsPerDegree;

  const centreAzimuth = start.azimuthDeg + middle;
  return {
    start: { x: toX(-middle), y: elevationToY(start.elevationDeg) },
    peak: { x: toX(peakOffset - middle), y: elevationToY(peak.elevationDeg) },
    end: { x: toX(endOffset - middle), y: elevationToY(end.elevationDeg) },
    ticks: CARDINALS.flatMap(({ label, azimuthDeg }) => {
      const offset = signedTurn(centreAzimuth, azimuthDeg);
      return Math.abs(offset) <= halfWindow ? [{ label, x: toX(offset) }] : [];
    }),
  };
}

/**
 * Two parabolic halves meeting at the peak with a level tangent. The control points sit midway in x,
 * so x is linear along each half and the curve can never double back on itself.
 */
function pathData({ start, peak, end }: SkyLayout): string {
  const [x0, y0, xk, yk, x2, y2] = [start.x, start.y, peak.x, peak.y, end.x, end.y].map(round1);
  return `M ${x0} ${y0} Q ${round1((x0 + xk) / 2)} ${yk} ${xk} ${yk} Q ${round1((xk + x2) / 2)} ${yk} ${x2} ${y2}`;
}

/** Direction of travel at the set point, in degrees, for the arrowhead. */
function endHeadingDeg({ peak, end }: SkyLayout): number {
  const controlX = (peak.x + end.x) / 2;
  return (Math.atan2(end.y - peak.y, end.x - controlX) * 180) / Math.PI;
}

function describePass({ start, peak, end }: SkyArcProps['pass']): string {
  return (
    `Sky path: rises in the ${compassPoint(start.azimuthDeg)}, ` +
    `reaches ${Math.round(peak.elevationDeg)} degrees in the ${compassPoint(peak.azimuthDeg)}, ` +
    `sets in the ${compassPoint(end.azimuthDeg)}.`
  );
}

const DOME_PATH = `M ${DOME_LEFT} ${HORIZON_Y} A ${(DOME_RIGHT - DOME_LEFT) / 2} ${HORIZON_Y - ZENITH_Y} 0 0 1 ${DOME_RIGHT} ${HORIZON_Y} Z`;

/** A small half-dome of sky: azimuth runs across, elevation runs up, and the ISS draws an arch. */
export const SkyArc = memo(function SkyArc({ pass, decorative = false, className }: SkyArcProps) {
  const clipId = `sky-dome-${useId().replace(/:/g, '')}`;
  const layout = layoutPass(pass);
  const d = pathData(layout);
  const label = `${Math.round(pass.peak.elevationDeg)}°`;
  // Near the zenith the label would be clipped above the dome, so it drops below the arch instead.
  const labelY = layout.peak.y < ZENITH_Y + 14 ? layout.peak.y + 15 : layout.peak.y - 6;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      className={clsx('h-auto max-w-full shrink-0', className)}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : describePass(pass)}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={DOME_PATH} />
        </clipPath>
      </defs>

      <path d={DOME_PATH} className="fill-sky/40 stroke-ocean" strokeWidth={2} strokeLinejoin="round" />
      <g clipPath={`url(#${clipId})`}>
        {GUIDE_ELEVATIONS_DEG.map((elevation) => (
          <line
            key={elevation}
            x1={DOME_LEFT}
            x2={DOME_RIGHT}
            y1={elevationToY(elevation)}
            y2={elevationToY(elevation)}
            className="stroke-ocean/60"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        ))}
      </g>
      <line
        x1={DOME_LEFT}
        x2={DOME_RIGHT}
        y1={HORIZON_Y}
        y2={HORIZON_Y}
        className="stroke-ink-soft"
        strokeWidth={2}
        strokeLinecap="round"
      />

      {layout.ticks.map(({ label: cardinal, x }) => (
        <g key={cardinal}>
          <line x1={x} x2={x} y1={HORIZON_Y} y2={HORIZON_Y + 4} className="stroke-ink-soft" strokeWidth={2} strokeLinecap="round" />
          <text x={x} y={LABEL_Y} textAnchor="middle" fontSize={FONT_SIZE} fontWeight={700} className="fill-ink-soft font-mono">
            {cardinal}
          </text>
        </g>
      ))}

      <path d={d} fill="none" className="stroke-paper" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={d}
        fill="none"
        className={pass.visible ? 'stroke-coral-deep' : 'stroke-ink-soft'}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle cx={layout.start.x} cy={layout.start.y} r={3.4} className="fill-paper stroke-ink" strokeWidth={1.5} />
      <g transform={`translate(${round1(layout.end.x)} ${round1(layout.end.y)}) rotate(${round1(endHeadingDeg(layout))})`}>
        <path d="M 2 0 L -6 -4.5 L -6 4.5 Z" className={pass.visible ? 'fill-coral-deep' : 'fill-ink-soft'} />
      </g>
      <circle cx={layout.peak.x} cy={layout.peak.y} r={2.6} className="fill-butter-deep stroke-ink" strokeWidth={1.2} />
      <text
        x={layout.peak.x}
        y={labelY}
        textAnchor="middle"
        fontSize={FONT_SIZE}
        fontWeight={700}
        className="fill-ink font-mono"
        stroke="#FFFDF8"
        strokeWidth={3.5}
        paintOrder="stroke"
      >
        {label}
      </text>
    </svg>
  );
});
