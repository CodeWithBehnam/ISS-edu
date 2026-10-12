import { create } from 'zustand';

import {
  createLiveClock,
  scrubbedTo,
  withPaused,
  withRate,
  type PlaybackRate,
  type SimClock,
} from '@/lib/time/sim-clock';

export type ViewMode = 'isometric' | 'follow' | 'free';
export type Units = 'metric' | 'imperial';

export interface Observer {
  latitude: number;
  longitude: number;
  label: string;
  source: 'geolocation' | 'city';
}

export interface Layers {
  orbit: boolean;
  footprint: boolean;
  clouds: boolean;
  labels: boolean;
}

export interface TrackerState {
  clock: SimClock;
  viewMode: ViewMode;
  units: Units;
  layers: Layers;
  observer: Observer | null;
  reducedMotion: boolean;
  /** Incremented to ask the camera rig to return to its default framing. */
  cameraResetToken: number;

  setViewMode: (mode: ViewMode) => void;
  setUnits: (units: Units) => void;
  toggleLayer: (layer: keyof Layers) => void;
  setObserver: (observer: Observer | null) => void;
  setRate: (rate: PlaybackRate) => void;
  setPaused: (paused: boolean) => void;
  scrubTo: (simMs: number) => void;
  goLive: () => void;
  setReducedMotion: (enabled: boolean) => void;
  requestCameraReset: () => void;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const useTrackerStore = create<TrackerState>((set) => ({
  clock: createLiveClock(Date.now()),
  viewMode: 'follow',
  units: 'metric',
  layers: { orbit: true, footprint: true, clouds: true, labels: true },
  observer: null,
  reducedMotion: prefersReducedMotion(),
  cameraResetToken: 0,

  setViewMode: (viewMode) => set({ viewMode }),
  setUnits: (units) => set({ units }),
  toggleLayer: (layer) => set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),
  setObserver: (observer) => set({ observer }),
  setRate: (rate) => set((s) => ({ clock: withRate(s.clock, rate, Date.now()) })),
  setPaused: (paused) => set((s) => ({ clock: withPaused(s.clock, paused, Date.now()) })),
  scrubTo: (simMs) => set((s) => ({ clock: scrubbedTo(s.clock, simMs, Date.now()) })),
  goLive: () => set({ clock: createLiveClock(Date.now()) }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  requestCameraReset: () => set((s) => ({ cameraResetToken: s.cameraResetToken + 1 })),
}));
