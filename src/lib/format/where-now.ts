import type { ShadowTransition } from '@/lib/astro/sun';
import { formatCountdown } from '@/lib/format/units';
import type { RegionLabel } from '@/lib/geo/regions';
import { EARTH_RADIUS_KM } from '@/lib/orbit/frames';

/** "Hudson Bay" is the only water name in the region data that takes no article. */
const WATERS_WITHOUT_ARTICLE: ReadonlySet<string> = new Set(['Hudson Bay']);
const COUNTRIES_WITH_ARTICLE =
  /^(United |Republic of |Democratic Republic |Central African |Dominican Republic|Falkland |Solomon |Netherlands|Philippines|Gambia)/;

/** "the Pacific Ocean", "Brazil", "the United Kingdom": so the sentence reads "Over ...". */
export function placeWithArticle(region: RegionLabel): string {
  if (region.kind === 'ocean') {
    return WATERS_WITHOUT_ARTICLE.has(region.name) ? region.name : `the ${region.name}`;
  }
  if (region.name.startsWith('The ')) return `the ${region.name.slice(4)}`;
  return COUNTRIES_WITH_ARTICLE.test(region.name) ? `the ${region.name}` : region.name;
}

/** Full width of the circle of Earth the crew can see from this height, edge to edge. */
export function horizonDiameterKm(altitudeKm: number): number {
  return 2 * EARTH_RADIUS_KM * Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altitudeKm));
}

export function describeTransition(next: ShadowTransition, nowMs: number): string {
  const remainingMs = next.at.getTime() - nowMs;
  const when = remainingMs > 1000 ? formatCountdown(remainingMs) : 'any moment now';
  return next.kind === 'enter-shadow' ? `Enters Earth's shadow ${when}` : `Sunrise ${when}`;
}
