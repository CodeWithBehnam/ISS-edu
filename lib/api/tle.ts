/**
 * TLE (Two-Line Element) fetching and caching utilities.
 * Fetches ISS TLE data from CelesTrak GP (no auth required).
 * Cache duration: 6 hours (as per spec).
 */

const CELESTRAK_ISS_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';
const TLE_CACHE_KEY = 'iss:tle';
const TLE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface TLEState {
  tle: string; // Raw two-line TLE string
  fetchedAt: string; // ISO timestamp
  epoch: string; // TLE epoch timestamp
}

/**
 * Fetches ISS TLE from CelesTrak.
 * Returns raw two-line TLE string.
 */
export async function fetchIssTle(): Promise<string> {
  const response = await fetch(CELESTRAK_ISS_URL, {
    cache: 'no-cache',
    headers: {
      'User-Agent': 'Orbital-Learning-Hub/0.1 (+https://orbital-learning-hub)',
      'Accept': 'text/plain',
    },
  });

  if (!response.ok) {
    throw new Error(`TLE fetch failed: HTTP ${response.status}`);
  }

  const text = await response.text();
  const lines = text.trim().split('\n').filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('Invalid TLE format: expected at least 2 lines');
  }

  // Return last two lines (in case there's a header line)
  return lines.slice(-2).join('\n');
}

/**
 * Parses TLE epoch from the TLE string.
 * TLE line 1 contains the epoch in YYDDD.DDDDDDDD format.
 */
export function parseTleEpoch(tle: string): Date {
  const lines = tle.trim().split('\n');
  if (lines.length < 1) {
    throw new Error('Invalid TLE: no lines found');
  }

  const line1 = lines[0].trim();
  // Epoch is at positions 18-32 (YYDDD.DDDDDDDD)
  const epochStr = line1.substring(18, 32).trim();
  const epochYear = Number.parseInt(epochStr.substring(0, 2), 10);
  const epochDay = Number.parseFloat(epochStr.substring(2));

  // Years 00-57 are 2000-2057, 58+ are 1958-1999
  const fullYear = epochYear <= 57 ? 2000 + epochYear : 1900 + epochYear;

  // Convert day of year to Date
  const date = new Date(Date.UTC(fullYear, 0, 1));
  date.setUTCDate(epochDay);

  return date;
}

/**
 * Gets TLE from localStorage cache if still valid.
 */
export function getCachedTle(): TLEState | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(TLE_CACHE_KEY);
    if (!cached) return null;

    const state: TLEState = JSON.parse(cached);
    const age = Date.now() - new Date(state.fetchedAt).getTime();

    if (age > TLE_CACHE_TTL_MS) {
      localStorage.removeItem(TLE_CACHE_KEY);
      return null;
    }

    return state;
  } catch {
    return null;
  }
}

/**
 * Caches TLE state in localStorage.
 */
export function setCachedTle(state: TLEState): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(TLE_CACHE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors
  }
}

/**
 * Fetches fresh TLE or returns cached if still valid.
 */
export async function getIssTle(): Promise<TLEState> {
  // Try cache first
  const cached = getCachedTle();
  if (cached) {
    return cached;
  }

  // Fetch fresh
  const tle = await fetchIssTle();
  const epoch = parseTleEpoch(tle);
  const state: TLEState = {
    tle,
    fetchedAt: new Date().toISOString(),
    epoch: epoch.toISOString(),
  };

  setCachedTle(state);
  return state;
}

