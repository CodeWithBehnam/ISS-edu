import { z } from 'zod';

import { pointInPolygon, pointInRing, type Ring } from '@/lib/geo/point-in-polygon';
import { normaliseLongitude } from '@/lib/orbit/frames';
import type { GeoPoint } from '@/lib/orbit/types';

export interface CountryShape {
  name: string;
  iso2: string | null;
  /** [minLon, minLat, maxLon, maxLat], used as a cheap prefilter. */
  bbox: [number, number, number, number];
  /** Polygons, each a list of rings (first ring outer, the rest holes) of [lon, lat]. */
  polygons: Array<Array<Array<[number, number]>>>;
}

export type RegionLabel =
  | { kind: 'country'; name: string; iso2: string | null; flag: string | null }
  | { kind: 'ocean'; name: string };

const positionSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const ringSchema = z.array(positionSchema).min(4);
const polygonSchema = z.array(ringSchema).min(1);

const countryShapeSchema = z.object({
  name: z.string().min(1),
  iso2: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
  bbox: z
    .tuple([z.number(), z.number(), z.number(), z.number()])
    .refine(([west, south, east, north]) => west <= east && south <= north, 'bbox is inverted'),
  polygons: z.array(polygonSchema).min(1),
});

const countriesFileSchema = z.object({
  version: z.literal(1),
  source: z.string(),
  countries: z.array(countryShapeSchema).min(1),
});

/** Validates the file written by `scripts/build-countries.ts`; throws a ZodError when malformed. */
export function parseCountries(json: unknown): CountryShape[] {
  return countriesFileSchema.parse(json).countries;
}

/** Regional-indicator pair for an ISO 3166-1 alpha-2 code, e.g. "GB" -> 🇬🇧. */
export function flagEmoji(iso2: string | null): string | null {
  if (iso2 === null || !/^[A-Za-z]{2}$/.test(iso2)) return null;
  const base = 0x1f1e6 - 'A'.charCodeAt(0);
  return String.fromCodePoint(
    ...iso2
      .toUpperCase()
      .split('')
      .map((letter) => base + letter.charCodeAt(0)),
  );
}

function insideBbox(lon: number, lat: number, [west, south, east, north]: CountryShape['bbox']) {
  return lon >= west && lon <= east && lat >= south && lat <= north;
}

/** Country under the point, otherwise the sea or ocean it floats in. */
export function findRegion(point: GeoPoint, countries: readonly CountryShape[]): RegionLabel {
  const lon = normaliseLongitude(point.longitude);
  const lat = point.latitude;
  const hit = countries.find(
    (country) =>
      insideBbox(lon, lat, country.bbox) &&
      country.polygons.some((rings) => pointInPolygon(lon, lat, rings)),
  );
  if (hit) {
    return { kind: 'country', name: hit.name, iso2: hit.iso2, flag: flagEmoji(hit.iso2) };
  }
  return { kind: 'ocean', name: oceanName({ latitude: lat, longitude: lon }) };
}

interface Sea {
  name: string;
  rings: readonly Ring[];
}

const box = (west: number, south: number, east: number, north: number): Ring => [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
];

/*
 * Deliberately coarse outlines for labelling only. They are tested after the country
 * polygons, so they may freely overlap land; they just must not bleed into open ocean.
 * Order matters where outlines touch: the first match wins, and every sea comes before
 * the ocean fallback so e.g. the Caribbean is never reported as the Atlantic.
 */
const SEAS: readonly Sea[] = [
  { name: 'Hudson Bay', rings: [box(-95.5, 51, -76.5, 66.4)] },
  {
    name: 'Gulf of Mexico',
    rings: [
      [
        [-98, 18],
        [-98, 30.5],
        [-82.5, 30.5],
        [-81.8, 25.5],
        [-83.5, 23.2],
        [-84.9, 22],
        [-86.9, 21.5],
        [-90.5, 18],
      ],
    ],
  },
  {
    name: 'Caribbean Sea',
    rings: [
      [
        [-84.9, 22],
        [-82, 22.6],
        [-78, 21.6],
        [-74.5, 20.3],
        [-68.5, 18.8],
        [-66.5, 18.2],
        [-64.5, 18.3],
        [-63, 18.2],
        [-61, 14.6],
        [-61.5, 12],
        [-61, 9.5],
        [-61, 8.5],
        [-77, 8],
        [-79.5, 9.1],
        [-83, 9.5],
        [-89, 15.5],
        [-89, 18],
        [-86.9, 21.5],
      ],
    ],
  },
  {
    name: 'Mediterranean Sea',
    rings: [
      [
        [-5.6, 35.5],
        [-5.6, 36.3],
        [3, 43],
        [3, 46],
        [13.8, 46],
        [19.4, 41.3],
        [23, 41.3],
        [26, 41],
        [26.7, 40.6],
        [28, 39.6],
        [36.7, 38],
        [36.7, 30],
        [10, 30],
        [-2, 33.5],
      ],
    ],
  },
  { name: 'Black Sea', rings: [box(27.3, 40.9, 41.9, 47.4)] },
  { name: 'Caspian Sea', rings: [box(46.4, 36.4, 54.9, 47.2)] },
  {
    name: 'Baltic Sea',
    rings: [
      [
        [9.8, 53.4],
        [9.8, 57.8],
        [11, 57.8],
        [14.5, 57],
        [16.5, 66],
        [30.5, 66],
        [30.5, 53.4],
      ],
    ],
  },
  {
    name: 'North Sea',
    rings: [
      [
        [1.5, 50.9],
        [-1, 52.5],
        [-2.5, 55],
        [-4.5, 57.6],
        [-3.2, 58.6],
        [-3, 61],
        [5.5, 61],
        [11, 59.5],
        [11, 57.8],
        [9.8, 57.8],
        [9.8, 53.5],
        [4.5, 51.5],
      ],
    ],
  },
  { name: 'Red Sea', rings: [box(32, 12.4, 43.6, 30)] },
  { name: 'Persian Gulf', rings: [box(47.5, 23.8, 56.4, 30.6)] },
  { name: 'Arabian Sea', rings: [box(43.7, 5, 77.6, 25.6)] },
  { name: 'Bay of Bengal', rings: [box(77.6, 5, 96, 23)] },
  { name: 'South China Sea', rings: [box(99.5, 0, 121.5, 25)] },
  { name: 'Coral Sea', rings: [box(142.5, -25, 164, -9)] },
  { name: 'Tasman Sea', rings: [box(148.5, -46, 173.5, -25)] },
  // Split in two because the sea straddles the antimeridian.
  { name: 'Bering Sea', rings: [box(163, 52, 180, 66.5), box(-180, 52, -157, 66.5)] },
];

const ARCTIC_MIN_LAT = 66.5;
const SOUTHERN_MAX_LAT = -60;
/** Cape Horn meridian: west of it the Drake Passage belongs to the Pacific. */
const CAPE_HORN_LON = -67.3;
/** Cape Agulhas meridian, the Atlantic and Indian boundary. */
const CAPE_AGULHAS_LON = 20;

/**
 * Western edge of the Atlantic: a meridian that falls on land between the two coasts at
 * each latitude band (South America, Central America, North America), so no sea point is ambiguous.
 */
function atlanticWestLimit(lat: number): number {
  if (lat < -55.5) return CAPE_HORN_LON;
  if (lat < 12) return -70;
  return -84;
}

function indianOceanEastLimit(lat: number): number {
  if (lat <= -11) return 147; // Tasmania's South East Cape
  if (lat < 0) return 130;
  return 100; // Malacca Strait
}

/** Name of the sea or ocean at a point; callers should test land first. */
export function oceanName(point: GeoPoint): string {
  const lat = point.latitude;
  const lon = normaliseLongitude(point.longitude);

  const sea = SEAS.find((candidate) => candidate.rings.some((ring) => pointInRing(lon, lat, ring)));
  if (sea) return sea.name;

  const whiteSeaSector = lat >= 60 && lon >= 30.5 && lon < 100;
  if (lat >= ARCTIC_MIN_LAT || whiteSeaSector) return 'Arctic Ocean';
  if (lat <= SOUTHERN_MAX_LAT) return 'Southern Ocean';

  if (lon >= atlanticWestLimit(lat) && lon < CAPE_AGULHAS_LON) return 'Atlantic Ocean';
  if (lon >= CAPE_AGULHAS_LON && lon < indianOceanEastLimit(lat)) return 'Indian Ocean';
  return 'Pacific Ocean';
}
