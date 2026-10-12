import { useCallback, useEffect, useRef, useState } from 'react';

import { clientLog } from '@/lib/observability/client-log';
import { useTrackerStore } from '@/lib/state/tracker-store';

export type GeolocationStatus = 'idle' | 'pending' | 'granted' | 'denied' | 'unavailable' | 'error';

interface GeolocationState {
  status: GeolocationStatus;
  error: string | null;
}

const IDLE: GeolocationState = { status: 'idle', error: null };

const POSITION_OPTIONS: PositionOptions = {
  // City-level accuracy is plenty for pass times and avoids waiting on a GPS fix.
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 5 * 60 * 1000,
};

/** Two decimal places is about 1 km: enough for passes, and it keeps precise positions out of state. */
const roundCoordinate = (value: number): number => Math.round(value * 100) / 100;

function describeFailure(error: GeolocationPositionError): GeolocationState {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return {
        status: 'denied',
        error: 'Location access was declined. You can choose a city instead.',
      };
    case error.TIMEOUT:
      return { status: 'error', error: 'Finding your location took too long. Please try again.' };
    default:
      return { status: 'error', error: 'Your device could not work out where you are.' };
  }
}

/** Browser location lookup. Never prompts on mount: nothing happens until `request()` is called. */
export function useGeolocation(): {
  request: () => void;
  status: GeolocationStatus;
  error: string | null;
} {
  const setObserver = useTrackerStore((state) => state.setObserver);
  const [state, setState] = useState<GeolocationState>(IDLE);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const request = useCallback((): void => {
    const update = (next: GeolocationState): void => {
      if (mounted.current) setState(next);
    };

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      update({
        status: 'unavailable',
        error: 'This browser cannot share your location. Please choose a city.',
      });
      return;
    }

    update({ status: 'pending', error: null });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setObserver({
          latitude: roundCoordinate(coords.latitude),
          longitude: roundCoordinate(coords.longitude),
          label: 'Your location',
          source: 'geolocation',
        });
        update({ status: 'granted', error: null });
      },
      (failure) => {
        clientLog('info', 'geolocation-failed', { code: failure.code });
        update(describeFailure(failure));
      },
      POSITION_OPTIONS,
    );
  }, [setObserver]);

  return { request, status: state.status, error: state.error };
}
