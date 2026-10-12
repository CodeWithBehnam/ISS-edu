import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { pointInPolygon, pointInRing } from '@/lib/geo/point-in-polygon';
import {
  findRegion,
  flagEmoji,
  oceanName,
  parseCountries,
  type CountryShape,
} from '@/lib/geo/regions';

const countriesFile = new URL('../../public/data/countries-110m.json', import.meta.url);
const countries: CountryShape[] = parseCountries(JSON.parse(readFileSync(countriesFile, 'utf8')));

const at = (latitude: number, longitude: number) => ({ latitude, longitude });

describe('pointInRing and pointInPolygon', () => {
  const square = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ] as const;
  const hole = [
    [4, 4],
    [6, 4],
    [6, 6],
    [4, 6],
    [4, 4],
  ] as const;

  it('detects points inside and outside a ring, closed or open', () => {
    expect(pointInRing(5, 5, square)).toBe(true);
    expect(pointInRing(11, 5, square)).toBe(false);
    expect(pointInRing(5, -1, square)).toBe(false);
    expect(pointInRing(5, 5, square.slice(0, 4))).toBe(true);
  });

  it('treats later rings as holes', () => {
    expect(pointInPolygon(2, 2, [square, hole])).toBe(true);
    expect(pointInPolygon(5, 5, [square, hole])).toBe(false);
  });

  it('is false for a polygon without rings', () => {
    expect(pointInPolygon(5, 5, [])).toBe(false);
  });
});

describe('parseCountries', () => {
  it('loads the generated file with plausible content', () => {
    expect(countries.length).toBeGreaterThan(150);
    const uk = countries.find((country) => country.name === 'United Kingdom');
    expect(uk?.iso2).toBe('GB');
    expect(uk?.bbox[0]).toBeLessThan(uk?.bbox[2] ?? 0);
  });

  it('throws on malformed input', () => {
    expect(() => parseCountries(null)).toThrow();
    expect(() => parseCountries({ version: 2, source: 'x', countries: [] })).toThrow();
    expect(() =>
      parseCountries({
        version: 1,
        source: 'x',
        countries: [{ name: 'Nowhere', iso2: 'xx', bbox: [0, 0, 1, 1], polygons: [] }],
      }),
    ).toThrow();
  });
});

describe('flagEmoji', () => {
  it('maps ISO codes to regional indicator pairs', () => {
    expect(flagEmoji('GB')).toBe('🇬🇧');
    expect(flagEmoji('br')).toBe('🇧🇷');
  });

  it('returns null for missing or malformed codes', () => {
    expect(flagEmoji(null)).toBeNull();
    expect(flagEmoji('')).toBeNull();
    expect(flagEmoji('GBR')).toBeNull();
    expect(flagEmoji('1A')).toBeNull();
  });
});

describe('findRegion over land', () => {
  it.each([
    ['London', at(51.51, -0.13), 'United Kingdom', 'GB'],
    ['Paris', at(48.86, 2.35), 'France', 'FR'],
    ['Tehran', at(35.69, 51.39), 'Iran', 'IR'],
    ['Sydney', at(-33.87, 151.21), 'Australia', 'AU'],
    ['São Paulo', at(-23.55, -46.63), 'Brazil', 'BR'],
    ['Oslo', at(59.91, 10.75), 'Norway', 'NO'],
  ])('%s is in %s', (_city, point, name, iso2) => {
    expect(findRegion(point, countries)).toEqual({
      kind: 'country',
      name,
      iso2,
      flag: flagEmoji(iso2),
    });
  });

  it('labels the United Kingdom with its flag', () => {
    expect(findRegion(at(51.51, -0.13), countries)).toMatchObject({ flag: '🇬🇧' });
  });

  it('finds Lesotho inside the hole of South Africa', () => {
    const maseru = at(-29.31, 27.48);
    const southAfrica = countries.find((country) => country.name === 'South Africa');
    const holed = southAfrica?.polygons.find((rings) => rings.length > 1);
    expect(holed).toBeDefined();
    expect(pointInPolygon(maseru.longitude, maseru.latitude, holed ?? [])).toBe(false);
    expect(findRegion(maseru, countries)).toMatchObject({ kind: 'country', name: 'Lesotho' });
    expect(findRegion(at(-26.2, 28.05), countries)).toMatchObject({ name: 'South Africa' });
  });

  it('handles longitudes outside [-180, 180) and the antimeridian', () => {
    expect(findRegion(at(51.51, 359.87), countries)).toMatchObject({ name: 'United Kingdom' });
    expect(findRegion(at(-17.8, 178.0), countries)).toMatchObject({ name: 'Fiji' });
    expect(findRegion(at(-16.3, -179.95), countries)).toMatchObject({ name: 'Fiji' });
    expect(findRegion(at(66, 179.5), countries)).toMatchObject({ name: 'Russia' });
  });

  it('keeps French Guiana with France', () => {
    expect(findRegion(at(4.0, -53.0), countries)).toMatchObject({ name: 'France', iso2: 'FR' });
  });

  it('returns a country without a flag for contested territories', () => {
    expect(findRegion(at(9.5, 44.0), countries)).toEqual({
      kind: 'country',
      name: 'Somaliland',
      iso2: null,
      flag: null,
    });
  });
});

describe('findRegion over water', () => {
  it.each([
    ['Pacific Ocean', at(0, -160)],
    ['Atlantic Ocean', at(30, -40)],
    ['Indian Ocean', at(-20, 80)],
    ['Arctic Ocean', at(80, 0)],
    ['Southern Ocean', at(-62, -100)],
    ['Mediterranean Sea', at(35, 18)],
    ['Caribbean Sea', at(15, -75)],
  ])('reports the %s', (name, point) => {
    expect(findRegion(point, countries)).toEqual({ kind: 'ocean', name });
  });
});

describe('oceanName', () => {
  it.each([
    ['Gulf of Mexico', at(25, -90)],
    ['Hudson Bay', at(60, -85)],
    ['North Sea', at(56, 3)],
    ['Baltic Sea', at(58, 20)],
    ['Black Sea', at(43.5, 34)],
    ['Caspian Sea', at(42, 51)],
    ['Red Sea', at(20, 38)],
    ['Persian Gulf', at(27, 51.5)],
    ['Arabian Sea', at(15, 65)],
    ['Bay of Bengal', at(14, 87)],
    ['South China Sea', at(14, 114)],
    ['Coral Sea', at(-17, 155)],
    ['Tasman Sea', at(-38, 160)],
    ['Bering Sea', at(58, -175)],
    ['Bering Sea', at(58, 175)],
  ])('names the %s', (name, point) => {
    expect(oceanName(point)).toBe(name);
  });

  it('checks seas before oceans', () => {
    // These points lie in the longitude band of the Atlantic (or Pacific) but belong to a sea.
    expect(oceanName(at(15, -75))).toBe('Caribbean Sea');
    expect(oceanName(at(35, 18))).toBe('Mediterranean Sea');
    expect(oceanName(at(58, -175))).toBe('Bering Sea');
  });

  it('keeps the Atlantic seaboard of the Americas out of the Pacific', () => {
    expect(oceanName(at(40, -72))).toBe('Atlantic Ocean'); // off New York
    expect(oceanName(at(30, -77))).toBe('Atlantic Ocean'); // off Florida
    expect(oceanName(at(25, -73))).toBe('Atlantic Ocean'); // Bahamas
    expect(oceanName(at(-10, -34))).toBe('Atlantic Ocean'); // off Brazil
    expect(oceanName(at(35, -125))).toBe('Pacific Ocean'); // off California
    expect(oceanName(at(-20, -75))).toBe('Pacific Ocean'); // off Chile
  });

  it('splits the open oceans at the Drake Passage and the Cape Agulhas meridian', () => {
    expect(oceanName(at(-58, -75))).toBe('Pacific Ocean');
    expect(oceanName(at(-58, -60))).toBe('Atlantic Ocean');
    expect(oceanName(at(-40, 10))).toBe('Atlantic Ocean');
    expect(oceanName(at(-40, 30))).toBe('Indian Ocean');
    expect(oceanName(at(-40, 160))).toBe('Tasman Sea');
    expect(oceanName(at(-50, 170))).toBe('Pacific Ocean');
  });

  it('wraps longitude', () => {
    expect(oceanName(at(0, 200))).toBe('Pacific Ocean');
  });
});
