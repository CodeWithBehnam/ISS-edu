import { z } from 'zod';

import { fetchJson, formatZodError } from '@/lib/api/iss-tle';

export const CREW_FEED_URL =
  'https://corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json';

export interface CrewMember {
  name: string;
  country: string;
  /** Lower-case ISO 3166 code as used by the feed (for example "gb"). */
  flagCode: string | null;
  agency: string;
  position: string;
  spacecraft: string;
  daysInSpace: number | null;
  launchedAt: Date | null;
  url: string | null;
  imageUrl: string | null;
}

export interface CrewInfo {
  expedition: number | null;
  expeditionUrl: string | null;
  patchUrl: string | null;
  people: CrewMember[];
}

const crewFeedSchema = z.object({
  iss_expedition: z.number().int().nonnegative().nullish(),
  expedition_url: z.string().nullish(),
  expedition_patch: z.string().nullish(),
  // Checked per person below so astronauts on other stations never affect validation.
  people: z.array(z.unknown()),
});

const issFlagSchema = z.object({ iss: z.literal(true) }).passthrough();

const personSchema = z.object({
  name: z.string().trim().min(1),
  country: z.string().nullish(),
  flag_code: z.string().nullish(),
  agency: z.string().nullish(),
  position: z.string().nullish(),
  spacecraft: z.string().nullish(),
  launched: z.number().finite().nullish(),
  days_in_space: z.number().finite().nonnegative().nullish(),
  url: z.string().nullish(),
  image: z.string().nullish(),
});

type RawPerson = z.infer<typeof personSchema>;

/** The feed uses empty strings for "unknown"; treat them the same as missing. */
function textOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Only http(s) links reach the DOM, which rules out javascript: and data: URLs from a remote feed. */
function httpUrlOrNull(value: string | null | undefined): string | null {
  const text = textOrNull(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function launchDate(unixSeconds: number | null | undefined): Date | null {
  if (unixSeconds == null) return null;
  const date = new Date(unixSeconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toCrewMember(raw: RawPerson): CrewMember {
  return {
    name: raw.name,
    country: textOrNull(raw.country) ?? 'Unknown',
    flagCode: textOrNull(raw.flag_code)?.toLowerCase() ?? null,
    agency: textOrNull(raw.agency) ?? 'Unknown',
    position: textOrNull(raw.position) ?? 'Crew member',
    spacecraft: textOrNull(raw.spacecraft) ?? 'Unknown',
    daysInSpace: raw.days_in_space ?? null,
    launchedAt: launchDate(raw.launched),
    url: httpUrlOrNull(raw.url),
    imageUrl: httpUrlOrNull(raw.image),
  };
}

function parsePerson(raw: unknown, index: number): CrewMember {
  const result = personSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid crew member at people[${index}]: ${formatZodError(result.error)}`);
  }
  return toCrewMember(result.data);
}

const MS_PER_DAY = 86_400_000;

/**
 * Whole days since the launch of the current mission. The feed's `days_in_space` only counts earlier
 * flights (a first-time flyer reads 0 months into a stay), so it cannot answer "how long aboard".
 */
export function daysAboard(launchedAt: Date | null, nowMs: number): number | null {
  if (launchedAt === null) return null;
  return Math.max(0, Math.floor((nowMs - launchedAt.getTime()) / MS_PER_DAY));
}

const WIKIMEDIA_HOST = 'upload.wikimedia.org';
/** Wikimedia only scales these formats by file name; anything else is left alone. */
const RASTER_EXTENSIONS = /\.(?:jpe?g|png|gif|webp)$/i;
const VECTOR_EXTENSION = /\.svg$/i;
const ORIGINAL_FILE_PATH = /^\/wikipedia\/([a-z-]+)\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/;
/** Wikimedia answers any other thumbnail width with HTTP 400, so requests snap up to one of these. */
export const THUMBNAIL_WIDTHS = [20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840] as const;

function snapThumbnailWidth(widthPx: number): number {
  return THUMBNAIL_WIDTHS.find((width) => width >= widthPx) ?? THUMBNAIL_WIDTHS[THUMBNAIL_WIDTHS.length - 1];
}

/**
 * Wikimedia serves originals that can be thousands of pixels wide, which is megabytes for a 48 px
 * portrait. Its thumbnail path scales on demand (to the next standard width at or above `widthPx`);
 * any URL it cannot be applied to comes back unchanged.
 */
export function thumbnailUrl(url: string, widthPx: number): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const match = parsed.hostname === WIKIMEDIA_HOST ? ORIGINAL_FILE_PATH.exec(parsed.pathname) : null;
  if (!match || !Number.isFinite(widthPx) || widthPx < 1) return url;

  const [, project, firstDir, secondDir, file] = match;
  const isVector = VECTOR_EXTENSION.test(file);
  if (!isVector && !RASTER_EXTENSIONS.test(file)) return url;

  const thumbName = `${snapThumbnailWidth(widthPx)}px-${file}${isVector ? '.png' : ''}`;
  parsed.pathname = `/wikipedia/${project}/thumb/${firstDir}/${secondDir}/${file}/${thumbName}`;
  return parsed.href;
}

/** Pure boundary step: validates the feed and keeps only people currently aboard the ISS. */
export function normaliseCrew(json: unknown): CrewInfo {
  const feed = crewFeedSchema.safeParse(json);
  if (!feed.success) {
    throw new Error(`Invalid crew payload: ${formatZodError(feed.error)}`);
  }
  const { iss_expedition, expedition_url, expedition_patch, people } = feed.data;
  return {
    expedition: iss_expedition ?? null,
    expeditionUrl: httpUrlOrNull(expedition_url),
    patchUrl: httpUrlOrNull(expedition_patch),
    people: people.flatMap((raw, index) =>
      issFlagSchema.safeParse(raw).success ? [parsePerson(raw, index)] : [],
    ),
  };
}

export async function fetchCrew(signal?: AbortSignal): Promise<CrewInfo> {
  return normaliseCrew(await fetchJson(CREW_FEED_URL, { signal }));
}
