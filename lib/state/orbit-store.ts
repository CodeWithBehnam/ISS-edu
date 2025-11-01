/**
 * Enhanced store for orbit tracking state.
 * Manages TLE data, pass predictions, live polling, and UI settings.
 */

'use client';

import { create } from 'zustand';
import type { Pass } from '../lib/passes';
import type { TLEState } from '../api/tle';

export interface ObserverLocation {
  latitude: number;
  longitude: number;
  altitudeKm?: number;
  name?: string;
}

export interface OrbitState {
  // TLE data
  tle: TLEState | null;
  tleLoading: boolean;
  tleError: string | null;

  // Live telemetry
  liveMode: 'live' | 'tle-only'; // 'live' = wheretheiss.at active, 'tle-only' = degraded mode
  liveUpdateInterval: number; // seconds (default: 5)

  // Pass predictions
  observer: ObserverLocation | null;
  passes: Pass[];
  passesLoading: boolean;
  passesError: string | null;

  // Time scrubber
  virtualTime: Date | null; // null = real-time, Date = time travel mode
  timeWindowHours: number; // ±24h default

  // Settings
  units: 'metric' | 'imperial';
  reducedMotion: boolean;
  lowPowerMode: boolean; // Caps FPS to 30

  // Actions
  setTle: (tle: TLEState | null) => void;
  setTleLoading: (loading: boolean) => void;
  setTleError: (error: string | null) => void;
  setLiveMode: (mode: 'live' | 'tle-only') => void;
  setLiveUpdateInterval: (interval: number) => void;
  setObserver: (observer: ObserverLocation | null) => void;
  setPasses: (passes: Pass[]) => void;
  setPassesLoading: (loading: boolean) => void;
  setPassesError: (error: string | null) => void;
  setVirtualTime: (time: Date | null) => void;
  setTimeWindowHours: (hours: number) => void;
  setUnits: (units: 'metric' | 'imperial') => void;
  setReducedMotion: (enabled: boolean) => void;
  setLowPowerMode: (enabled: boolean) => void;
}

export const useOrbitStore = create<OrbitState>((set) => ({
  // TLE
  tle: null,
  tleLoading: false,
  tleError: null,

  // Live
  liveMode: 'live',
  liveUpdateInterval: 5,

  // Passes
  observer: null,
  passes: [],
  passesLoading: false,
  passesError: null,

  // Time scrubber
  virtualTime: null,
  timeWindowHours: 24,

  // Settings
  units: 'metric',
  reducedMotion: typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  lowPowerMode: false,

  // Actions
  setTle: (tle) => set({ tle }),
  setTleLoading: (loading) => set({ tleLoading: loading }),
  setTleError: (error) => set({ tleError: error }),
  setLiveMode: (mode) => set({ liveMode: mode }),
  setLiveUpdateInterval: (interval) => set({ liveUpdateInterval: interval }),
  setObserver: (observer) => set({ observer }),
  setPasses: (passes) => set({ passes }),
  setPassesLoading: (loading) => set({ passesLoading: loading }),
  setPassesError: (error) => set({ passesError: error }),
  setVirtualTime: (time) => set({ virtualTime: time }),
  setTimeWindowHours: (hours) => set({ timeWindowHours: hours }),
  setUnits: (units) => set({ units }),
  setReducedMotion: (enabled) => set({ reducedMotion: enabled }),
  setLowPowerMode: (enabled) => set({ lowPowerMode: enabled }),
}));

