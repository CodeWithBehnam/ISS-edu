import type { ReactNode } from 'react';
import clsx from 'clsx';
import { IconCheck } from './icons';

export interface ToggleChipProps {
  pressed: boolean;
  /** Receives the requested next state, so `() => toggle()` handlers work unchanged. */
  onToggle: (next: boolean) => void;
  label: string;
  icon?: ReactNode;
  className?: string;
}

export function ToggleChip({ pressed, onToggle, label, icon, className }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={clsx('toy-chip', className)}
      onClick={() => onToggle(!pressed)}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {label}
      {/* Fixed-size indicator keeps the width stable and gives a non-colour pressed cue. */}
      <span
        className={clsx(
          'grid h-4 w-4 shrink-0 place-items-center rounded-full border-2',
          pressed ? 'border-leaf bg-leaf text-ink' : 'border-line bg-paper',
        )}
        aria-hidden="true"
      >
        {pressed ? <IconCheck className="h-3 w-3" /> : null}
      </span>
    </button>
  );
}
