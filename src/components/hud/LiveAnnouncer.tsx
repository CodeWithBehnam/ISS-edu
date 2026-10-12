import { useEffect, useRef, useState } from 'react';

import {
  formatAltitude,
  formatLatitude,
  formatLongitude,
  formatSpeed,
} from '@/lib/format/units';
import type { RegionLabel } from '@/lib/geo/regions';
import { useIsLive } from '@/lib/hooks/useSimNow';
import type { OrbitState } from '@/lib/orbit/types';
import { useTrackerStore, type Units } from '@/lib/state/tracker-store';

export interface LiveAnnouncerProps {
  state: OrbitState | null;
  region: RegionLabel | null;
}

/** Screen-reader users get a fresh summary at most this often, so the page never chatters. */
const MIN_GAP_MS = 60_000;
/** How long to wait for the country data before falling back to coordinates. */
const REGION_GRACE_MS = 15_000;

/** Names that read naturally with "the": "over the Pacific Ocean", "over the United States". */
const NEEDS_ARTICLE =
  /^(united |netherlands|philippines|bahamas|gambia|czech republic|dominican republic|central african republic|democratic republic|republic of|comoros|maldives|seychelles|.* islands$|.* (ocean|sea|gulf)$|bay of |gulf of )/i;

function placeName(region: RegionLabel): string {
  // Spoken aloud, the full formal name is a mouthful.
  const bare = region.name.replace(/^the /i, '').replace(/^United States of America$/i, 'United States');
  return NEEDS_ARTICLE.test(bare) ? `the ${bare}` : bare;
}

function buildSummary(state: OrbitState, region: RegionLabel | null, units: Units): string {
  const altitude = formatAltitude(state.altitudeKm, units);
  const speed = formatSpeed(state.speedKps, units);
  if (region) {
    return `The ISS is over ${placeName(region)} at ${altitude}, travelling ${speed}.`;
  }
  const where = `${formatLatitude(state.latitude, 1)}, ${formatLongitude(state.longitude, 1)}`;
  return `The ISS is at ${where}, ${altitude} up, travelling ${speed}.`;
}

/**
 * Visually hidden live region. Politeness is "polite" and the text changes at most once a minute,
 * and only while the clock is live: scrubbing through time would otherwise read out a running commentary.
 */
export function LiveAnnouncer({ state, region }: LiveAnnouncerProps) {
  const live = useIsLive();
  const units = useTrackerStore((store) => store.units);
  const [message, setMessage] = useState('');
  const lastSpokenAt = useRef<number | null>(null);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (!live || !state) return;
    const now = Date.now();
    if (lastSpokenAt.current !== null && now - lastSpokenAt.current < MIN_GAP_MS) return;
    // Prefer a place name; fall back to coordinates only if the boundary data never arrives.
    if (!region && now - mountedAt.current < REGION_GRACE_MS) return;
    lastSpokenAt.current = now;
    setMessage(buildSummary(state, region, units));
  }, [live, state, region, units]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
