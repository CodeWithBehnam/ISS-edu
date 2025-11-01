

import { create } from 'zustand';

interface VisualSettings {
  showGroundTrack: boolean;
}

interface InteractionState {
  selectedLocation?: { name: string; latitude: number; longitude: number };
  setSelectedLocation: (payload: InteractionState['selectedLocation']) => void;
}

interface SettingsState extends VisualSettings, InteractionState {
  toggleGroundTrack: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  showGroundTrack: true,
  selectedLocation: undefined,
  toggleGroundTrack: () =>
    set((state) => ({ showGroundTrack: !state.showGroundTrack })),
  setSelectedLocation: (payload) => set({ selectedLocation: payload ?? undefined }),
}));
