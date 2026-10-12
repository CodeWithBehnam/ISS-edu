/**
 * Builds public/data/countries-110m.json from the Natural Earth 110 m country polygons that
 * ship with three-globe. Run with `bun run data:countries`.
 *
 * The geojson is ~490 kB at full precision; two decimal places (~1 km) is plenty for a
 * "currently over" label at this resolution and cuts the payload by about two thirds.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { parseCountries, type CountryShape } from '../src/lib/geo/regions';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = resolve(
  ROOT,
  'node_modules/three-globe/example/country-polygons/ne_110m_admin_0_countries.geojson',
);
const OUTPUT = resolve(ROOT, 'public/data/countries-110m.json');
const SOURCE = 'Natural Earth 110m Admin 0 Countries (public domain), via three-globe';

/**
 * Natural Earth marks France and Norway as -99 because of how it models overseas
 * territories and contested claims. Keyed by ADM0_A3. Disputed entities stay without a flag.
 */
const ISO2_OVERRIDES: Readonly<Record<string, string>> = { FRA: 'FR', NOR: 'NO' };

type Position = [number, number];
type Ring = Position[];
type Polygon = Ring[];

const rawRingSchema = z.array(z.array(z.number()).min(2));
const rawPolygonSchema = z.array(rawRingSchema);
const featureCollectionSchema = z.object({
  features: z.array(
    z.object({
      properties: z.record(z.unknown()),
      geometry: z.discriminatedUnion('type', [
        z.object({ type: z.literal('Polygon'), coordinates: rawPolygonSchema }),
        z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(rawPolygonSchema) }),
      ]),
    }),
  ),
});

type Feature = z.infer<typeof featureCollectionSchema>['features'][number];

/** Natural Earth uses the string "-99" (and sometimes the number) for "no value". */
function textProperty(properties: Record<string, unknown>, key: string): string | null {
  const value = properties[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' || trimmed === '-99' ? null : trimmed;
}

function firstText(properties: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = textProperty(properties, key);
    if (value !== null) return value;
  }
  return null;
}

function resolveIso2(properties: Record<string, unknown>): string | null {
  const code = firstText(properties, ['ISO_A2', 'ISO_A2_EH']);
  if (code !== null) return /^[A-Z]{2}$/.test(code) ? code : null;
  const adm0 = textProperty(properties, 'ADM0_A3');
  return adm0 !== null ? (ISO2_OVERRIDES[adm0] ?? null) : null;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Rounding can collapse neighbouring vertices; drop repeats so rings stay valid. */
function roundRing(ring: readonly (readonly number[])[]): Ring {
  return ring
    .map((position): Position => [round2(position[0]), round2(position[1])])
    .filter((position, index, all) => {
      const previous = all[index - 1];
      return previous === undefined || previous[0] !== position[0] || previous[1] !== position[1];
    });
}

function roundPolygon(rings: readonly (readonly (readonly number[])[])[]): Polygon | null {
  const [outer, ...holes] = rings.map(roundRing);
  // A polygon whose outer ring degenerated has nothing left to keep; a collapsed hole is just dropped.
  if (outer === undefined || outer.length < 4) return null;
  return [outer, ...holes.filter((hole) => hole.length >= 4)];
}

function boundingBox(polygons: readonly Polygon[]): CountryShape['bbox'] {
  const positions = polygons.flatMap((rings) => rings[0]);
  const lons = positions.map(([lon]) => lon);
  const lats = positions.map(([, lat]) => lat);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

function toCountry(feature: Feature): CountryShape | null {
  const { properties, geometry } = feature;
  const name = firstText(properties, ['ADMIN', 'NAME']);
  if (name === null) return null;

  const rawPolygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const polygons = rawPolygons.flatMap((raw) => {
    const polygon = roundPolygon(raw);
    return polygon === null ? [] : [polygon];
  });
  if (polygons.length === 0) return null;

  return { name, iso2: resolveIso2(properties), bbox: boundingBox(polygons), polygons };
}

async function main(): Promise<void> {
  const parsed = featureCollectionSchema.parse(JSON.parse(await readFile(INPUT, 'utf8')));
  const countries = parsed.features.flatMap((feature) => {
    const country = toCountry(feature);
    return country === null ? [] : [country];
  });

  const output = JSON.stringify({ version: 1, source: SOURCE, countries });
  // Round-trip through the runtime parser so a bad build can never reach the app.
  parseCountries(JSON.parse(output));

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, output);

  const kib = (Buffer.byteLength(output) / 1024).toFixed(1);
  const withoutFlag = countries.filter((country) => country.iso2 === null).map((c) => c.name);
  process.stdout.write(
    `Wrote ${countries.length} countries (${kib} KiB) to ${OUTPUT}\n` +
      `No ISO code: ${withoutFlag.join(', ') || 'none'}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `build-countries failed: ${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
