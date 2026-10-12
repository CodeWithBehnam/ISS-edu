import { useMemo } from 'react';

import type { LiveTelemetry } from '@/lib/api/iss-telemetry';
import type { RegionLabel } from '@/lib/geo/regions';
import { useIssState } from '@/lib/hooks/useIssState';
import { useRegion } from '@/lib/hooks/useRegion';
import type { GeoPoint, OrbitState, SatRec } from '@/lib/orbit/types';

/**
 * One propagation and one boundary lookup per second. Shared with the screen reader
 * announcer so both describe the same place without a second source of truth.
 */
export function useIssRegion(
  satrec: SatRec | null,
  telemetry: LiveTelemetry | null,
): { state: OrbitState | null; region: RegionLabel | null } {
  const state = useIssState(satrec, 1);
  const latitude = state?.latitude ?? telemetry?.latitude;
  const longitude = state?.longitude ?? telemetry?.longitude;
  const point = useMemo<GeoPoint | null>(
    () => (latitude === undefined || longitude === undefined ? null : { latitude, longitude }),
    [latitude, longitude],
  );
  const region = useRegion(point);
  return { state, region };
}
