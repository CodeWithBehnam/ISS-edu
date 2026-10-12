import { useEffect } from 'react';

import { useTrackerStore } from '@/lib/state/tracker-store';

const QUERY = '(prefers-reduced-motion: reduce)';

/** Keeps the store flag in step with the OS setting, including changes made while the page is open. */
export function useReducedMotionSync(): void {
  const setReducedMotion = useTrackerStore((state) => state.setReducedMotion);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(QUERY);
    setReducedMotion(media.matches);
    const onChange = (event: MediaQueryListEvent): void => setReducedMotion(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [setReducedMotion]);
}
