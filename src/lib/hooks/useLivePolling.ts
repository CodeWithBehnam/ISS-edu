/**
 * Hook for live ISS position polling with exponential backoff.
 * Falls back to TLE-only mode if API is unavailable.
 */



import { useEffect, useRef, useCallback, useState } from 'react';
import { useOrbitStore } from '../state/orbit-store';
import { propagateToGeodetic } from '@/lib/lib/propagation';
import type { IssTelemetry } from '../types/telemetry';

const WHERE_ISS_AT_URL = 'https://api.wheretheiss.at/v1/satellites/25544';
const MAX_BACKOFF_MS = 40000; // 40 seconds
const INITIAL_INTERVAL_MS = 5000; // 5 seconds

interface LivePollState {
  interval: number;
  consecutiveFailures: number;
  lastSuccess: number | null;
}

export function useLivePolling() {
  const {
    liveMode,
    liveUpdateInterval,
    setLiveMode,
    tle,
  } = useOrbitStore();

  const stateRef = useRef<LivePollState>({
    interval: INITIAL_INTERVAL_MS,
    consecutiveFailures: 0,
    lastSuccess: null,
  });

  const poll = useCallback(async () => {
    try {
      const response = await fetch(WHERE_ISS_AT_URL, {
        headers: {
          'User-Agent': 'Orbital-Learning-Hub/0.1',
          'Accept': 'application/json',
        },
      });

      if (response.status === 429) {
        // Rate limited - exponential backoff
        stateRef.current.interval = Math.min(
          stateRef.current.interval * 2,
          MAX_BACKOFF_MS
        );
        stateRef.current.consecutiveFailures++;
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      stateRef.current.consecutiveFailures = 0;
      stateRef.current.lastSuccess = Date.now();
      stateRef.current.interval = liveUpdateInterval * 1000;

      // Dispatch telemetry update (you can extend the store to handle this)
      // For now, we'll just mark as live mode
      setLiveMode('live');

      return data as {
        latitude: number;
        longitude: number;
        altitude: number;
        velocity: number;
        timestamp: number;
      };
    } catch (error) {
      stateRef.current.consecutiveFailures++;
      stateRef.current.interval = Math.min(
        stateRef.current.interval * 2,
        MAX_BACKOFF_MS
      );

      // After 3 consecutive failures, switch to TLE-only mode
      if (stateRef.current.consecutiveFailures >= 3 && tle) {
        setLiveMode('tle-only');
      }

      console.warn('Live polling error:', error);
      return null;
    }
  }, [liveUpdateInterval, setLiveMode, tle]);

  useEffect(() => {
    if (liveMode === 'tle-only' && !tle) {
      // Can't poll in TLE-only mode without TLE
      return;
    }

    const scheduleNext = () => {
      const timeout = setTimeout(() => {
        void poll().then(() => {
          scheduleNext();
        });
      }, stateRef.current.interval);

      return timeout;
    };

    const timeout = scheduleNext();

    return () => clearTimeout(timeout);
  }, [liveMode, tle, poll]);

  return { mode: liveMode };
}

/**
 * Gets current ISS position based on live mode.
 * Falls back to TLE propagation if live API is unavailable.
 */
export function useCurrentIssPosition(): IssTelemetry | null {
  const { liveMode, tle, virtualTime } = useOrbitStore();
  const [liveData, setLiveData] = useState<IssTelemetry | null>(null);

  // Poll live data when in live mode
  useEffect(() => {
    if (liveMode !== 'live') {
      setLiveData(null);
      return;
    }

    const poll = async () => {
      try {
        const response = await fetch(WHERE_ISS_AT_URL);
        if (!response.ok) return;
        const data = await response.json();
        setLiveData({
          timestamp: new Date(data.timestamp * 1000).toISOString(),
          latitude: data.latitude,
          longitude: data.longitude,
          altitudeKm: data.altitude,
          velocityKps: data.velocity,
          visibility: 'daylight', // Simplified
          footprintKm: data.footprint ?? 0,
          source: 'where-iss-at',
        });
      } catch {
        // Ignore errors
      }
    };

    void poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [liveMode]);

  // Use TLE propagation if in TLE-only mode or if virtual time is set
  if (liveMode === 'tle-only' || virtualTime || !liveData) {
    if (!tle) return null;

    const targetTime = virtualTime ?? new Date();
    try {
      const position = propagateToGeodetic(tle.tle, targetTime);
      return {
        timestamp: targetTime.toISOString(),
        latitude: position.latitude,
        longitude: position.longitude,
        altitudeKm: position.altitudeKm,
        velocityKps: 7.66, // Approximate ISS velocity
        visibility: 'daylight',
        footprintKm: 0,
        source: 'sgp4-fallback',
      };
    } catch {
      return null;
    }
  }

  return liveData;
}

