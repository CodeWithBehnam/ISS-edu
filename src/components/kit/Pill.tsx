import type { ReactNode } from 'react';
import clsx from 'clsx';

export type PillTone = 'live' | 'neutral' | 'warn' | 'day' | 'night' | 'info';

export interface PillProps {
  tone: PillTone;
  children: ReactNode;
  /** Shows a softly pulsing dot; the animation is removed under reduced motion. */
  pulse?: boolean;
  className?: string;
}

// Record keeps the mapping exhaustive when a tone is added. Every pairing keeps 4.5:1 text contrast.
const TONE_CLASSES: Record<PillTone, string> = {
  live: 'border-coral-deep bg-coral text-ink',
  neutral: 'border-line bg-paper text-ink',
  warn: 'border-blush bg-peach text-ink',
  day: 'border-butter-deep bg-butter text-ink',
  night: 'border-grape bg-night text-white',
  info: 'border-ocean bg-sky text-ink',
};

export function Pill({ tone, children, pulse = false, className }: PillProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-2.5 py-0.5 text-xs font-bold leading-5',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {pulse ? (
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className="absolute inset-0 animate-ping-soft rounded-full bg-current" />
          <span className="relative h-2 w-2 rounded-full bg-current" />
        </span>
      ) : null}
      {children}
    </span>
  );
}
