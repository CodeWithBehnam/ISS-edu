import { useMemo } from 'react';

import { useSimNow } from '@/lib/hooks/useSimNow';
import { propagateState } from '@/lib/orbit/satrec';
import type { OrbitState, SatRec } from '@/lib/orbit/types';

/** SGP4 state at sim time, for DOM readouts. The 3D scene propagates per frame on its own. */
export function useIssState(satrec: SatRec | null, hz = 4): OrbitState | null {
  const now = useSimNow(hz);
  return useMemo(() => (satrec ? propagateState(satrec, now) : null), [satrec, now]);
}
