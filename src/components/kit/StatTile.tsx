import type { ReactNode } from 'react';
import clsx from 'clsx';

export interface StatTileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  /** `true` or `'hero'` enlarges the value and tints the tile; `'normal'` and `false` leave it plain. */
  emphasis?: boolean | 'normal' | 'hero';
  className?: string;
}

export function StatTile({ label, value, unit, hint, emphasis = false, className }: StatTileProps) {
  const hero = emphasis === true || emphasis === 'hero';

  return (
    <dl
      className={clsx(
        'm-0 min-w-0 rounded-2xl border-2 px-3.5 py-2.5',
        hero ? 'border-butter-deep bg-butter/50' : 'border-line bg-cream/70',
        className,
      )}
    >
      <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className="m-0 mt-0.5">
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <span
            className={clsx(
              'font-mono font-bold tabular-nums leading-tight text-ink',
              hero ? 'text-3xl sm:text-4xl' : 'text-xl',
            )}
          >
            {value}
          </span>
          {unit ? <span className="font-mono text-sm font-medium text-ink-soft">{unit}</span> : null}
        </span>
        {hint ? <span className="mt-0.5 block text-xs font-semibold text-ink-soft">{hint}</span> : null}
      </dd>
    </dl>
  );
}
