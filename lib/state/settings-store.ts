'use client';

import { create } from 'zustand';

interface VisualSettings {
  showGroundTrack: boolean;
  showCityLights: boolean;
  showTerminator: boolean;
  showAurora: boolean;
}

interface InteractionState {
  selectedLocation?: { name: string; latitude: number; longitude: number };
  setSelectedLocation: (payload: InteractionState['selectedLocation']) => void;
}

interface SettingsState extends VisualSettings, InteractionState {
  toggleGroundTrack: () => void;
  toggleCityLights: () => void;
  toggleTerminator: () => void;
  toggleAurora: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  showGroundTrack: true,
  showCityLights: true,
  showTerminator: true,
  showAurora: false,
  selectedLocation: undefined,
  toggleGroundTrack: () =>
    set((state) => ({ showGroundTrack: !state.showGroundTrack })),
  toggleCityLights: () =>
    set((state) => ({ showCityLights: !state.showCityLights })),
  toggleTerminator: () =>
    set((state) => ({ showTerminator: !state.showTerminator })),
  toggleAurora: () => set((state) => ({ showAurora: !state.showAurora })),
  setSelectedLocation: (payload) => set({ selectedLocation: payload ?? undefined }),
}));

