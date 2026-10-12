import type { PillTone } from '@/components/kit';

export interface TimePill {
  tone: PillTone;
  label: string;
  pulse: boolean;
}

/** Wording for the status pill; a paused clock is never "live", even when it sits on real time. */
export function describeTimeStatus(live: boolean, paused: boolean, rate: number): TimePill {
  if (live) return { tone: 'live', label: 'Live', pulse: true };
  if (paused) return { tone: 'warn', label: 'Paused', pulse: false };
  return {
    tone: 'info',
    label: rate > 1 ? `Time travel · ${rate}×` : 'Time travel',
    pulse: false,
  };
}
