import type { Units } from '@/lib/state/tracker-store';

/** Shown instead of "NaN" when a value is not yet known. */
const UNKNOWN = 'n/a';

const KM_PER_MILE = 1.609344;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86_400;

const COMPASS_POINTS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;

const integerFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** Only wraps when needed, so in-range values keep their exact digits. */
function wrapLongitude(deg: number): number {
  if (deg >= -180 && deg < 180) return deg;
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

export function formatLatitude(deg: number, digits = 2): string {
  if (!Number.isFinite(deg)) return UNKNOWN;
  const magnitude = Math.abs(deg).toFixed(digits);
  // "-0.00" would otherwise read as a southern latitude of nothing.
  const south = deg < 0 && Number(magnitude) !== 0;
  return `${magnitude}° ${south ? 'S' : 'N'}`;
}

export function formatLongitude(deg: number, digits = 2): string {
  if (!Number.isFinite(deg)) return UNKNOWN;
  const wrapped = wrapLongitude(deg);
  const magnitude = Math.abs(wrapped).toFixed(digits);
  const west = wrapped < 0 && Number(magnitude) !== 0;
  return `${magnitude}° ${west ? 'W' : 'E'}`;
}

const toDisplayDistance = (km: number, units: Units): number =>
  units === 'imperial' ? km / KM_PER_MILE : km;

const distanceUnit = (units: Units): string => (units === 'imperial' ? 'mi' : 'km');

export function formatAltitude(km: number, units: Units): string {
  if (!Number.isFinite(km)) return UNKNOWN;
  return `${integerFormat.format(toDisplayDistance(km, units))} ${distanceUnit(units)}`;
}

export function formatSpeed(kps: number, units: Units): string {
  if (!Number.isFinite(kps)) return UNKNOWN;
  const kmPerHour = kps * SECONDS_PER_HOUR;
  const value = integerFormat.format(toDisplayDistance(kmPerHour, units));
  return `${value} ${units === 'imperial' ? 'mph' : 'km/h'}`;
}

/** One decimal place below 10 so short hops such as a 0.8 km drift stay readable. */
export function formatDistance(km: number, units: Units): string {
  if (!Number.isFinite(km)) return UNKNOWN;
  const value = toDisplayDistance(km, units);
  const text = Math.abs(value) < 10 ? decimalFormat.format(value) : integerFormat.format(value);
  return `${text} ${distanceUnit(units)}`;
}

/** 16-wind compass point for an azimuth measured clockwise from north. */
export function compassPoint(azimuthDeg: number): string {
  if (!Number.isFinite(azimuthDeg)) return UNKNOWN;
  const wrapped = ((azimuthDeg % 360) + 360) % 360;
  return COMPASS_POINTS[Math.round(wrapped / 22.5) % COMPASS_POINTS.length];
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return UNKNOWN;
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} s`;
  if (total < SECONDS_PER_HOUR) return `${Math.floor(total / 60)} min ${pad2(total % 60)} s`;
  const hours = Math.floor(total / SECONDS_PER_HOUR);
  return `${hours} h ${pad2(Math.floor((total % SECONDS_PER_HOUR) / 60))} min`;
}

/** Whole seconds, minutes, hours or days; coarser units drop the finer ones that no longer matter. */
function formatSpan(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds} s`;
  if (totalSeconds < SECONDS_PER_HOUR) return `${Math.floor(totalSeconds / 60)} min`;
  if (totalSeconds < SECONDS_PER_DAY) {
    const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / 60);
    return `${Math.floor(totalSeconds / SECONDS_PER_HOUR)} h ${pad2(minutes)} min`;
  }
  const hours = Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  return `${Math.floor(totalSeconds / SECONDS_PER_DAY)} d ${hours} h`;
}

/** Positive `ms` is in the future ("in 2 h 13 min"), negative is in the past ("12 min ago"). */
export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms)) return UNKNOWN;
  const totalSeconds = Math.round(Math.abs(ms) / 1000);
  if (totalSeconds < 1) return 'now';
  return ms > 0 ? `in ${formatSpan(totalSeconds)}` : `${formatSpan(totalSeconds)} ago`;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

/** Intl formatters are costly to build and these run several times a second, so reuse them. */
function cachedFormatter(
  kind: 'clock' | 'day',
  timeZone: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${kind}|${timeZone ?? ''}`;
  const existing = formatterCache.get(key);
  if (existing) return existing;
  const created = new Intl.DateTimeFormat('en-GB', { ...options, timeZone });
  formatterCache.set(key, created);
  return created;
}

const isValidDate = (date: Date): boolean => !Number.isNaN(date.getTime());

/** 24-hour clock, e.g. "14:05:09". */
export function formatClock(date: Date, timeZone?: string): string {
  if (!isValidDate(date)) return UNKNOWN;
  return cachedFormatter('clock', timeZone, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

/** Short day label, e.g. "Mon 12 Oct". Assembled from parts so ICU punctuation cannot vary. */
export function formatDay(date: Date, timeZone?: string): string {
  if (!isValidDate(date)) return UNKNOWN;
  const parts = cachedFormatter('day', timeZone, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('weekday')} ${part('day')} ${part('month')}`;
}
