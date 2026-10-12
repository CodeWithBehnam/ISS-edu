import { SIM_WINDOW_MS } from '@/lib/time/sim-clock';

const MINUTE_MS = 60_000;
export const MAX_OFFSET_MINUTES = SIM_WINDOW_MS / MINUTE_MS;
/** A real minus sign reads better next to digits than a hyphen. */
const MINUS = '−';

/** Whole minutes between real and sim time, clamped to what the slider can express. */
export function offsetMinutes(simMs: number, realNowMs: number): number {
  const minutes = Math.round((simMs - realNowMs) / MINUTE_MS);
  return Math.min(MAX_OFFSET_MINUTES, Math.max(-MAX_OFFSET_MINUTES, minutes));
}

function splitHoursMinutes(totalMinutes: number): { hours: number; minutes: number } {
  const total = Math.abs(totalMinutes);
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

/** Compact label such as "+2 h 14 min" or "−45 min"; zero is "Now". */
export function formatOffset(minutes: number): string {
  if (minutes === 0) return 'Now';
  const { hours, minutes: rest } = splitHoursMinutes(minutes);
  const parts = [hours > 0 ? `${hours} h` : '', rest > 0 ? `${rest} min` : ''].filter(Boolean);
  return `${minutes > 0 ? '+' : MINUS}${parts.join(' ')}`;
}

const plural = (count: number, unit: string): string => `${count} ${unit}${count === 1 ? '' : 's'}`;

/** Spoken form for aria-valuetext, because "+2 h 14 min" is read out poorly by screen readers. */
export function describeOffset(minutes: number): string {
  if (minutes === 0) return 'now';
  const { hours, minutes: rest } = splitHoursMinutes(minutes);
  const span = [hours > 0 ? plural(hours, 'hour') : '', rest > 0 ? plural(rest, 'minute') : '']
    .filter(Boolean)
    .join(' ');
  return minutes > 0 ? `${span} from now` : `${span} ago`;
}
