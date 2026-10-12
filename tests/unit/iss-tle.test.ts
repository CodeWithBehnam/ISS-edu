import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CELESTRAK_ISS_TLE_URL,
  TLE_CACHE_KEY,
  WHERETHEISS_ISS_TLE_URL,
  getIssTle,
  parseTleText,
  tleChecksum,
  tleEpochFromLine1,
} from '@/lib/api/iss-tle';

const LINE1 = '1 25544U 98067A   26284.17638745  .00009430  00000+0  18014-3 0  9995';
const LINE2 = '2 25544  51.6312  86.0933 0006713 248.1316 111.8959 15.48821882589734';
// Celestrak pads the name line with trailing spaces.
const CELESTRAK_BODY = `ISS (ZARYA)             \n${LINE1}\n${LINE2}\n`;

/** Replaces a column range and rewrites the checksum so only the intended defect remains. */
function withValidChecksum(line: string): string {
  return `${line.slice(0, 68)}${tleChecksum(line)}`;
}

describe('tleChecksum', () => {
  it('matches the checksum digit of the real ISS lines', () => {
    expect(tleChecksum(LINE1)).toBe(5);
    expect(tleChecksum(LINE2)).toBe(4);
  });

  it('counts minus signs as one', () => {
    expect(tleChecksum(`${'-'.repeat(68)}0`)).toBe(8);
  });
});

describe('parseTleText', () => {
  it('parses a three-line set and trims the name', () => {
    expect(parseTleText(CELESTRAK_BODY)).toEqual({
      name: 'ISS (ZARYA)',
      line1: LINE1,
      line2: LINE2,
    });
  });

  it('parses a two-line set with the default name', () => {
    expect(parseTleText(`${LINE1}\n${LINE2}`)).toEqual({
      name: 'ISS (ZARYA)',
      line1: LINE1,
      line2: LINE2,
    });
  });

  it('uses a supplied fallback name for two-line sets', () => {
    expect(parseTleText(`${LINE1}\n${LINE2}`, 'ISS').name).toBe('ISS');
  });

  it('accepts CRLF line endings and blank lines', () => {
    const text = `\r\nISS (ZARYA)\r\n${LINE1}\r\n\r\n${LINE2}\r\n`;
    expect(parseTleText(text).line2).toBe(LINE2);
  });

  it('rejects a bad checksum', () => {
    const corrupted = `${LINE1.slice(0, 68)}6`;
    expect(() => parseTleText(`${corrupted}\n${LINE2}`)).toThrow(/line 1.*checksum/i);
  });

  it('rejects a bad checksum on line 2', () => {
    const corrupted = `${LINE2.slice(0, 68)}5`;
    expect(() => parseTleText(`${LINE1}\n${corrupted}`)).toThrow(/line 2.*checksum/i);
  });

  it('rejects a single flipped digit in the body', () => {
    const corrupted = LINE2.replace('51.6312', '51.6313');
    expect(() => parseTleText(`${LINE1}\n${corrupted}`)).toThrow(/checksum/i);
  });

  it('rejects lines that are not 69 characters', () => {
    expect(() => parseTleText(`${LINE1.slice(0, 60)}\n${LINE2}`)).toThrow(
      /expected 69 characters, got 60/,
    );
  });

  it('rejects swapped lines', () => {
    expect(() => parseTleText(`${LINE2}\n${LINE1}`)).toThrow(/line 1.*must start with "1 "/);
  });

  it('rejects element sets for two different objects', () => {
    const other = withValidChecksum(LINE2.replace('25544', '25545'));
    expect(() => parseTleText(`${LINE1}\n${other}`)).toThrow(/catalogue numbers differ/);
  });

  it('rejects the wrong number of lines', () => {
    expect(() => parseTleText('')).toThrow(/got 0/);
    expect(() => parseTleText(LINE1)).toThrow(/got 1/);
    expect(() => parseTleText(`a\nb\n${LINE1}\n${LINE2}`)).toThrow(/got 4/);
  });

  it('rejects an HTML error page served with a 200', () => {
    expect(() => parseTleText('<html>\n<body>No GP data found</body>\n</html>')).toThrow(
      /Invalid TLE/,
    );
  });
});

describe('tleEpochFromLine1', () => {
  it('converts year and fractional day to UTC', () => {
    const epoch = tleEpochFromLine1(LINE1);
    expect(Math.abs(epoch.getTime() - Date.UTC(2026, 9, 11, 4, 14, 0))).toBeLessThan(1000);
  });

  it('maps two-digit years from 57 upwards to the twentieth century', () => {
    const line = `${LINE1.slice(0, 18)}98001.00000000${LINE1.slice(32)}`;
    expect(tleEpochFromLine1(line).toISOString()).toBe('1998-01-01T00:00:00.000Z');
  });

  it('rejects an unreadable epoch', () => {
    const blankEpoch = `${LINE1.slice(0, 18)}${' '.repeat(14)}${LINE1.slice(32)}`;
    expect(() => tleEpochFromLine1(blankEpoch)).toThrow(/epoch/);
  });
});

describe('getIssTle', () => {
  let store: Map<string, string>;

  const respond = (routes: Record<string, () => Response>) =>
    vi.fn(async (url: string) => {
      const route = routes[url];
      if (!route) throw new Error(`unexpected request to ${url}`);
      return route();
    });

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches from Celestrak and caches the result', async () => {
    const fetchMock = respond({ [CELESTRAK_ISS_TLE_URL]: () => new Response(CELESTRAK_BODY) });
    vi.stubGlobal('fetch', fetchMock);

    const record = await getIssTle();

    expect(record).toMatchObject({
      name: 'ISS (ZARYA)',
      line1: LINE1,
      line2: LINE2,
      source: 'celestrak',
    });
    expect(Date.parse(record.epoch)).toBe(tleEpochFromLine1(LINE1).getTime());
    expect(JSON.parse(store.get(TLE_CACHE_KEY) ?? 'null')).toEqual(record);
  });

  it('serves a fresh cache without touching the network', async () => {
    const fetchMock = respond({ [CELESTRAK_ISS_TLE_URL]: () => new Response(CELESTRAK_BODY) });
    vi.stubGlobal('fetch', fetchMock);
    await getIssTle();
    fetchMock.mockClear();

    const again = await getIssTle();

    expect(again.line1).toBe(LINE1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to wheretheiss when Celestrak fails', async () => {
    const fetchMock = respond({
      [CELESTRAK_ISS_TLE_URL]: () => new Response('down', { status: 503 }),
      [WHERETHEISS_ISS_TLE_URL]: () =>
        Response.json({ header: 'ISS (ZARYA)', line1: LINE1, line2: LINE2 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const record = await getIssTle();

    expect(record.source).toBe('wheretheiss');
    expect(record.line2).toBe(LINE2);
  });

  it('falls back when Celestrak answers 200 with an invalid body', async () => {
    const fetchMock = respond({
      [CELESTRAK_ISS_TLE_URL]: () => new Response('No GP data found'),
      [WHERETHEISS_ISS_TLE_URL]: () => Response.json({ line1: LINE1, line2: LINE2 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    expect((await getIssTle()).source).toBe('wheretheiss');
  });

  it('works when storage throws on every access', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    vi.stubGlobal(
      'fetch',
      respond({ [CELESTRAK_ISS_TLE_URL]: () => new Response(CELESTRAK_BODY) }),
    );

    expect((await getIssTle()).line1).toBe(LINE1);
  });

  it('ignores a corrupt cache entry', async () => {
    store.set(TLE_CACHE_KEY, '{"name":"x"');
    vi.stubGlobal(
      'fetch',
      respond({ [CELESTRAK_ISS_TLE_URL]: () => new Response(CELESTRAK_BODY) }),
    );

    expect((await getIssTle()).source).toBe('celestrak');
  });

  it('reports both failures when no source and no cache is available', async () => {
    vi.stubGlobal(
      'fetch',
      respond({
        [CELESTRAK_ISS_TLE_URL]: () => new Response('down', { status: 503 }),
        [WHERETHEISS_ISS_TLE_URL]: () => new Response('down', { status: 500 }),
      }),
    );

    await expect(getIssTle()).rejects.toThrow(/celestrak: .*HTTP 503.*wheretheiss: .*HTTP 500/);
  });

  it('uses a stale cache as a last resort', async () => {
    const yesterday = new Date(Date.now() - 24 * 3_600_000).toISOString();
    store.set(
      TLE_CACHE_KEY,
      JSON.stringify({
        name: 'ISS (ZARYA)',
        line1: LINE1,
        line2: LINE2,
        epoch: tleEpochFromLine1(LINE1).toISOString(),
        source: 'celestrak',
        fetchedAt: yesterday,
      }),
    );
    vi.stubGlobal(
      'fetch',
      respond({
        [CELESTRAK_ISS_TLE_URL]: () => new Response('down', { status: 503 }),
        [WHERETHEISS_ISS_TLE_URL]: () => new Response('down', { status: 503 }),
      }),
    );

    expect((await getIssTle()).fetchedAt).toBe(yesterday);
  });
});
