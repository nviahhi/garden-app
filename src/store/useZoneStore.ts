import { create } from 'zustand';
import { zonesApi, type CreateZonePayload } from '../api/zones';
import type { Zone } from '../types';

interface ZoneState {
  zones: Zone[];
  currentZone: Zone | null;
  isLoading: boolean;

  loadZones: () => Promise<void>;
  selectZone: (id: number) => Promise<void>;
  createZone: (payload: CreateZonePayload) => Promise<Zone | null>;
  updateZone: (id: number, payload: Partial<CreateZonePayload>) => Promise<boolean>;
  removeZone: (id: number) => Promise<boolean>;
}

export const useZoneStore = create<ZoneState>((set, get) => ({
  zones: [],
  currentZone: null,
  isLoading: false,

  loadZones: async () => {
    set({ isLoading: true });
    try {
      const zones = await zonesApi.getAll();
      set({ zones, isLoading: false });

      // Автовыбор первой зоны, если ничего не выбрано
      if (!get().currentZone && zones.length > 0) {
        await get().selectZone(zones[0].id);
      }
    } catch (err) {
      console.error('Ошибка загрузки зон:', err);
      set({ isLoading: false });
    }
  },

  selectZone: async (id: number) => {
    try {
      const zone = await zonesApi.getOne(id);
      set({ currentZone: zone });
    } catch (err) {
      console.error('Ошибка загрузки зоны:', err);
    }
  },

  createZone: async (payload) => {
    try {
      const created = await zonesApi.create(payload);
      set({ zones: [...get().zones, created] });
      // Сразу переключаемся на новую
      set({ currentZone: created });
      return created;
    } catch (err) {
      console.error('Ошибка создания зоны:', err);
      return null;
    }
  },

  updateZone: async (id, payload) => {
    try {
      const updated = await zonesApi.update(id, payload);
      set({
        zones: get().zones.map((z) => (z.id === id ? { ...z, ...updated } : z)),
        currentZone: get().currentZone?.id === id ? updated : get().currentZone,
      });
      return true;
    } catch (err) {
      console.error('Ошибка обновления зоны:', err);
      return false;
    }
  },

  removeZone: async (id) => {
    try {
      await zonesApi.remove(id);
      const remaining = get().zones.filter((z) => z.id !== id);
      set({
        zones: remaining,
        currentZone: get().currentZone?.id === id
          ? (remaining[0] ?? null)
          : get().currentZone,
      });
      return true;
    } catch (err) {
      console.error('Ошибка удаления зоны:', err);
      return false;
    }
  },
}));