import { create } from 'zustand';
import { seasonApi } from '../api/season';

interface SeasonState {
  seasonStart: string | null;
  isLoading: boolean;

  load: () => Promise<void>;
  start: () => Promise<boolean>;
  reset: () => Promise<boolean>;
}

export const useSeasonStore = create<SeasonState>((set) => ({
  seasonStart: null,
  isLoading: false,

  load: async () => {
    set({ isLoading: true });
    try {
      const { season_start } = await seasonApi.get();
      set({ seasonStart: season_start ?? null, isLoading: false });
    } catch (err) {
      console.error('Ошибка загрузки сезона:', err);
      set({ isLoading: false });
    }
  },

  start: async () => {
    try {
      const { season_start } = await seasonApi.start();
      set({ seasonStart: season_start });
      return true;
    } catch (err) {
      console.error('Ошибка начала сезона:', err);
      return false;
    }
  },

  reset: async () => {
    try {
      await seasonApi.reset();
      set({ seasonStart: null });
      return true;
    } catch (err) {
      console.error('Ошибка сброса сезона:', err);
      return false;
    }
  },
}));
