import { describe, expect, it } from 'vitest';

import { CITIES, searchCities } from '@/lib/geo/cities';

describe('CITIES', () => {
  it('has at least 60 cities with valid coordinates', () => {
    expect(CITIES.length).toBeGreaterThanOrEqual(60);
    for (const entry of CITIES) {
      expect(entry.name).not.toBe('');
      expect(entry.country).not.toBe('');
      expect(Math.abs(entry.latitude)).toBeLessThanOrEqual(90);
      expect(Math.abs(entry.longitude)).toBeLessThanOrEqual(180);
    }
  });

  it('has unique names', () => {
    const names = CITIES.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('includes the UK cities and Tehran', () => {
    const names = CITIES.map((entry) => entry.name);
    for (const name of ['London', 'Manchester', 'Edinburgh', 'Cardiff', 'Belfast', 'Tehran']) {
      expect(names).toContain(name);
    }
  });

  it('covers every inhabited continent', () => {
    const covered = (south: number, north: number, west: number, east: number) =>
      CITIES.some(
        (c) =>
          c.latitude >= south && c.latitude <= north && c.longitude >= west && c.longitude <= east,
      );
    expect(covered(35, 70, -10, 40)).toBe(true); // Europe
    expect(covered(-35, 35, -20, 50)).toBe(true); // Africa
    expect(covered(5, 55, 60, 145)).toBe(true); // Asia
    expect(covered(15, 70, -170, -60)).toBe(true); // North America
    expect(covered(-55, 10, -80, -35)).toBe(true); // South America
    expect(covered(-50, -10, 110, 180)).toBe(true); // Oceania
  });
});

describe('searchCities', () => {
  it('is case-insensitive', () => {
    expect(searchCities('LONDON')[0]?.name).toBe('London');
    expect(searchCities('lOnDoN')[0]?.name).toBe('London');
  });

  it('ignores diacritics in both the query and the data', () => {
    expect(searchCities('sao')[0]?.name).toBe('São Paulo');
    expect(searchCities('São P')[0]?.name).toBe('São Paulo');
    expect(searchCities('zurich')[0]?.name).toBe('Zürich');
    expect(searchCities('Zürich')[0]?.name).toBe('Zürich');
    expect(searchCities('bogota')[0]?.name).toBe('Bogotá');
    expect(searchCities('reykjavik')[0]?.name).toBe('Reykjavík');
  });

  it('puts name prefixes before word and substring matches', () => {
    const names = searchCities('san', 20).map((c) => c.name);
    expect(names[0]).toBe('San Francisco');
    // "Santiago" also starts with "san" and sorts after San Francisco.
    expect(names.indexOf('Santiago')).toBeGreaterThan(names.indexOf('San Francisco'));

    const york = searchCities('york').map((c) => c.name);
    expect(york).toContain('New York');
  });

  it('ranks a name prefix above a later word match', () => {
    // "Rio de Janeiro" and "Riyadh" start with "ri"; "Buenos Aires" and others only contain it.
    const names = searchCities('ri', 20).map((c) => c.name);
    expect(names.slice(0, 2)).toEqual(['Rio de Janeiro', 'Riyadh']);
    // "Cape Town" only matches "town" as a whole word, which still beats a plain substring.
    expect(searchCities('town')[0]?.name).toBe('Cape Town');
  });

  it('ranks word-prefix matches above substring matches', () => {
    // "Angeles" starts a word in "Los Angeles"; "Bangkok" and "Shanghai" only contain "ang".
    const names = searchCities('ang', 20).map((c) => c.name);
    expect(names[0]).toBe('Los Angeles');
    expect(names).toEqual(expect.arrayContaining(['Bangkok', 'Shanghai']));
  });

  it('matches the country when no name matches well', () => {
    const names = searchCities('united kingdom', 20).map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['London', 'Manchester', 'Edinburgh']));
  });

  it('honours the limit and defaults to eight results', () => {
    expect(searchCities('a', 3)).toHaveLength(3);
    expect(searchCities('a').length).toBeLessThanOrEqual(8);
    expect(searchCities('a', 100).length).toBeGreaterThan(8);
  });

  it('returns nothing for blank queries, no match or a non-positive limit', () => {
    expect(searchCities('')).toEqual([]);
    expect(searchCities('   ')).toEqual([]);
    expect(searchCities('qqqqzzzz')).toEqual([]);
    expect(searchCities('london', 0)).toEqual([]);
  });

  it('returns each city only once', () => {
    const names = searchCities('l', 100).map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
