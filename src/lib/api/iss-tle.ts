import { z } from 'zod';

import { clientLog } from '@/lib/observability/client-log';
import type { TleRecord } from '@/lib/orbit/types';

export const CELESTRAK_ISS_TLE_URL =
  'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';
export const WHERETHEISS_ISS_TLE_URL = 'https://api.wheretheiss.at/v1/satellites/25544/tles';

export const TLE_CACHE_KEY = 'iss:tle:v2';
export const TLE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** An old TLE still tracks the ISS to within a few km for days, so it beats showing nothing offline. */
const TLE_STALE_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;

const DEFAULT_TLE_NAME = 'ISS (ZARYA)';
const TLE_LINE_LENGTH = 69;
const DAY_MS = 86_400_000;
const DEFAULT_TIMEOUT_MS = 10_000;

export interface ParsedTle {
  name: string;
  line1: string;
  line2: string;
}

export interface FetchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/* Shared boundary helpers: kept here because B1 owns only the three api files. */

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

/**
 * Plain GET with a hard timeout. No custom headers on purpose: any non-simple header
 * would force a CORS preflight that the public APIs do not need to answer.
 */
export async function fetchText(
  url: string,
  { signal, timeoutMs = DEFAULT_TIMEOUT_MS }: FetchOptions = {},
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`Request to ${url} timed out after ${timeoutMs} ms`)),
    timeoutMs,
  );
  const forwardAbort = (): void => controller.abort(signal?.reason);
  if (signal?.aborted) forwardAbort();
  else signal?.addEventListener('abort', forwardAbort, { once: true });

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Request to ${url} failed: HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

export async function fetchJson(url: string, options: FetchOptions = {}): Promise<unknown> {
  const text = await fetchText(url, options);
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`Response from ${url} is not valid JSON: ${errorMessage(error)}`);
  }
}

/** Mod-10 checksum over the first 68 columns: digits count as themselves, '-' as 1. */
export function tleChecksum(line: string): number {
  const sum = [...line.slice(0, TLE_LINE_LENGTH - 1)].reduce((total, char) => {
    if (char === '-') return total + 1;
    return /^\d$/.test(char) ? total + Number(char) : total;
  }, 0);
  return sum % 10;
}

function assertTleLine(line: string, lineNumber: 1 | 2): void {
  if (line.length !== TLE_LINE_LENGTH) {
    throw new Error(
      `Invalid TLE line ${lineNumber}: expected ${TLE_LINE_LENGTH} characters, got ${line.length}`,
    );
  }
  if (!line.startsWith(`${lineNumber} `)) {
    throw new Error(`Invalid TLE line ${lineNumber}: must start with "${lineNumber} "`);
  }
  const expected = tleChecksum(line);
  const found = line.charAt(TLE_LINE_LENGTH - 1);
  if (!/^\d$/.test(found) || Number(found) !== expected) {
    throw new Error(
      `Invalid TLE line ${lineNumber}: checksum mismatch (expected ${expected}, found "${found}")`,
    );
  }
}

/**
 * Parses two-line or three-line (name first) element sets and validates the line
 * numbers, length, checksum and that both lines describe the same catalogue object.
 */
export function parseTleText(text: string, fallbackName: string = DEFAULT_TLE_NAME): ParsedTle {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length !== 2 && lines.length !== 3) {
    throw new Error(`Invalid TLE text: expected 2 or 3 non-empty lines, got ${lines.length}`);
  }

  const [name, line1, line2] = lines.length === 3 ? lines : [fallbackName, ...lines];
  assertTleLine(line1, 1);
  assertTleLine(line2, 2);

  if (line1.slice(2, 7) !== line2.slice(2, 7)) {
    throw new Error(
      `Invalid TLE: catalogue numbers differ between lines ("${line1.slice(2, 7)}" vs "${line2.slice(2, 7)}")`,
    );
  }

  return { name: name.trim() || fallbackName, line1, line2 };
}

/** Epoch from line 1 columns 19-32 (two-digit year, then fractional day of year). */
export function tleEpochFromLine1(line1: string): Date {
  const twoDigitYear = Number(line1.slice(18, 20));
  const dayOfYear = Number(line1.slice(20, 32));
  if (
    !Number.isFinite(twoDigitYear) ||
    !Number.isFinite(dayOfYear) ||
    dayOfYear < 1 ||
    dayOfYear >= 367
  ) {
    throw new Error(`Invalid TLE epoch in line 1: "${line1.slice(18, 32)}"`);
  }
  const year = twoDigitYear < 57 ? 2000 + twoDigitYear : 1900 + twoDigitYear;
  return new Date(Date.UTC(year, 0, 1) + (dayOfYear - 1) * DAY_MS);
}

function toTleRecord(parsed: ParsedTle, source: TleRecord['source'], fetchedAt: Date): TleRecord {
  return {
    ...parsed,
    epoch: tleEpochFromLine1(parsed.line1).toISOString(),
    source,
    fetchedAt: fetchedAt.toISOString(),
  };
}

const cachedRecordSchema = z.object({
  name: z.string(),
  line1: z.string(),
  line2: z.string(),
  epoch: z.string(),
  source: z.enum(['celestrak', 'wheretheiss']),
  fetchedAt: z.string(),
});

/** Storage can throw on access (private windows, blocked site data), so every use is guarded. */
function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch (error) {
    clientLog('warn', 'tle-storage-unavailable', { message: errorMessage(error) });
    return null;
  }
}

interface CachedTle {
  record: TleRecord;
  ageMs: number;
}

function readCache(nowMs: number): CachedTle | null {
  const store = getStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(TLE_CACHE_KEY);
    if (!raw) return null;
    const cached = cachedRecordSchema.parse(JSON.parse(raw));
    // Re-validate the lines: a hand-edited or truncated entry must never reach SGP4.
    const parsed = parseTleText(`${cached.name}\n${cached.line1}\n${cached.line2}`);
    const fetchedMs = Date.parse(cached.fetchedAt);
    if (Number.isNaN(fetchedMs)) throw new Error('Cached TLE has an invalid fetchedAt timestamp');
    return { record: { ...cached, ...parsed }, ageMs: nowMs - fetchedMs };
  } catch (error) {
    clientLog('warn', 'tle-cache-invalid', { message: errorMessage(error) });
    return null;
  }
}

function writeCache(record: TleRecord): void {
  const store = getStorage();
  if (!store) return;
  try {
    store.setItem(TLE_CACHE_KEY, JSON.stringify(record));
  } catch (error) {
    clientLog('warn', 'tle-cache-write-failed', { message: errorMessage(error) });
  }
}

const whereTheIssTleSchema = z.object({
  header: z.string().optional(),
  line1: z.string(),
  line2: z.string(),
});

async function fetchFromCelestrak(signal?: AbortSignal): Promise<ParsedTle> {
  return parseTleText(await fetchText(CELESTRAK_ISS_TLE_URL, { signal }));
}

async function fetchFromWhereTheIss(signal?: AbortSignal): Promise<ParsedTle> {
  const result = whereTheIssTleSchema.safeParse(
    await fetchJson(WHERETHEISS_ISS_TLE_URL, { signal }),
  );
  if (!result.success) {
    throw new Error(`Unexpected wheretheiss TLE payload: ${formatZodError(result.error)}`);
  }
  const { header, line1, line2 } = result.data;
  return parseTleText(`${line1}\n${line2}`, header?.trim() || DEFAULT_TLE_NAME);
}

const TLE_SOURCES: ReadonlyArray<{
  id: TleRecord['source'];
  fetch: (signal?: AbortSignal) => Promise<ParsedTle>;
}> = [
  { id: 'celestrak', fetch: fetchFromCelestrak },
  { id: 'wheretheiss', fetch: fetchFromWhereTheIss },
];

/**
 * Newest ISS element set: fresh cache first, then Celestrak, then wheretheiss. If every
 * network source fails, a cache up to a week old is used rather than losing the tracker.
 */
export async function getIssTle(signal?: AbortSignal): Promise<TleRecord> {
  const cached = readCache(Date.now());
  if (cached && cached.ageMs >= 0 && cached.ageMs < TLE_CACHE_TTL_MS) return cached.record;

  const failures: string[] = [];
  for (const source of TLE_SOURCES) {
    try {
      const record = toTleRecord(await source.fetch(signal), source.id, new Date());
      writeCache(record);
      return record;
    } catch (error) {
      if (signal?.aborted) throw error;
      const message = errorMessage(error);
      failures.push(`${source.id}: ${message}`);
      clientLog('warn', 'tle-source-failed', { source: source.id, message });
    }
  }

  if (cached && cached.ageMs < TLE_STALE_LIMIT_MS) {
    clientLog('warn', 'tle-using-stale-cache', { ageHours: Math.round(cached.ageMs / 3_600_000) });
    return cached.record;
  }
  throw new Error(`Unable to load the ISS TLE (${failures.join('; ')})`);
}
