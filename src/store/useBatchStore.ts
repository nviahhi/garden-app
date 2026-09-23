import { create } from 'zustand';
import { batchesApi, type CreateBatchPayload } from '../api/batches';
import { plantsApi } from '../api/plants';
import type { Batch, Plant } from '../types';

interface BatchState {
  batches: Batch[];
  plants: Plant[];
  isLoading: boolean;

  loadBatches: () => Promise<void>;
  loadPlants: () => Promise<void>;
  createBatch: (payload: CreateBatchPayload) => Promise<boolean>;
  removeBatch: (id: number) => Promise<void>;
  germinateBatch: (batchId: number, count: number) => Promise<boolean>;
  markGerminated: (batchId: number) => Promise<boolean>;
  markPlantGerminated: (plantId: number) => Promise<boolean>;
  transplantPlant: (
    id: number,
    to_container_id: number,
    to_cell_index?: number,
    notes?: string
  ) => Promise<void>;
}

export const useBatchStore = create<BatchState>((set, get) => ({
  batches: [],
  plants: [],
  isLoading: false,

  loadBatches: async () => {
    set({ isLoading: true });
    try {
      const batches = await batchesApi.getAll();
      set({ batches, isLoading: false });
    } catch (err) {
      console.error('Ошибка загрузки партий:', err);
      set({ isLoading: false });
    }
  },

  loadPlants: async () => {
    try {
      const plants = await plantsApi.getAll();
      set({ plants });
    } catch (err) {
      console.error('Ошибка загрузки растений:', err);
    }
  },

  createBatch: async (payload) => {
    try {
      await batchesApi.create(payload);
      await get().loadBatches();
      await get().loadPlants();
      return true;
    } catch (err) {
      console.error('Ошибка создания партии:', err);
      return false;
    }
  },

  removeBatch: async (id) => {
    try {
      await batchesApi.remove(id);
      set({
        batches: get().batches.filter((b) => b.id !== id),
        plants: get().plants.filter((p) => p.batch_id !== id),
      });
    } catch (err) {
      console.error('Ошибка удаления партии:', err);
    }
  },

  germinateBatch: async (batchId, count) => {
    try {
      await batchesApi.germinate(batchId, count);
      await get().loadBatches();
      await get().loadPlants();
      return true;
    } catch (err) {
      console.error('Ошибка отметки всходов:', err);
      return false;
    }
  },

  markGerminated: async (batchId: number) => {
    try {
      await batchesApi.markGerminated(batchId);
      await get().loadPlants();
      await get().loadBatches();
      return true;
    } catch (err) {
      console.error('Ошибка отметки всходов:', err);
      return false;
    }
  },

  markPlantGerminated: async (plantId: number) => {
    try {
      const updated = await plantsApi.markGerminated(plantId);
      set({
        plants: get().plants.map((p) =>
          p.id === plantId ? { ...p, ...updated } : p
        ),
      });
      return true;
    } catch (err) {
      console.error('Ошибка отметки растения:', err);
      return false;
    }
  },

  transplantPlant: async (id, to_container_id, to_cell_index, notes) => {
    try {
      const updated = await plantsApi.transplant(id, {
        to_container_id,
        to_cell_index,
        notes,
      });
      set({
        plants: get().plants.map((p) =>
          p.id === id ? { ...p, ...updated } : p
        ),
      });
    } catch (err) {
      console.error('Ошибка пересадки:', err);
    }
  },
}));