import { create } from 'zustand';
import axios from 'axios';
import { batchesApi, type CreateBatchPayload } from '../api/batches';
import { plantsApi } from '../api/plants';
import type { Batch, Plant } from '../types';

interface BatchState {
  batches: Batch[];
  plants: Plant[];
  isLoading: boolean;

  // id растения, для которого панель уже загрузила историю событий.
  // Нужен, чтобы перезагрузка списка растений не «съедала» историю
  // и сразу показывала новые события (пересадка, смена статуса).
  eventsLoadedFor: number | null;

  loadBatches: () => Promise<void>;
  loadPlants: () => Promise<void>;
  createBatch: (payload: CreateBatchPayload) => Promise<{ success: boolean; error?: string }>;
  removeBatch: (id: number) => Promise<void>;
  germinateBatch: (batchId: number, count: number) => Promise<boolean>;
  markGerminated: (batchId: number) => Promise<boolean>;
  markPlantGerminated: (plantId: number) => Promise<boolean>;
  transplantPlant: (
    id: number,
    to_container_id: number,
    to_cell_index?: number,
    notes?: string
  ) => Promise<boolean>;
  setPlantStatus: (id: number, status: Plant['status']) => Promise<boolean>;
  removePlant: (id: number) => Promise<boolean>;
  addPlantEvent: (
    plantId: number,
    eventType: string,
    notes: string
  ) => Promise<boolean>;
  loadPlantWithEvents: (id: number) => Promise<Plant | null>;
  // Закрыть панель растения — перестать автообновлять его историю
  closePlantEvents: () => void;
}

export const useBatchStore = create<BatchState>((set, get) => ({
  batches: [],
  plants: [],
  isLoading: false,
  eventsLoadedFor: null,

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
      const fresh = await plantsApi.getAll();

      // GET /plants не отдаёт события, поэтому перезагрузка списка сносит
      // историю у открытой панели растения. Сохраняем уже загруженные
      // события, чтобы панель не «пустела», и обновляем их для открытой
      // панели — тогда новое событие (пересадка/статус) виден сразу.
      const previousById = new Map(get().plants.map((p) => [p.id, p]));
      const plants = fresh.map((p) => {
        const previous = previousById.get(p.id);
        return previous?.events ? { ...p, events: previous.events } : p;
      });
      set({ plants });

      const openPlantId = get().eventsLoadedFor;
      if (openPlantId != null && plants.some((p) => p.id === openPlantId)) {
        await get().loadPlantWithEvents(openPlantId);
      }
    } catch (err) {
      console.error('Ошибка загрузки растений:', err);
    }
  },

  createBatch: async (payload) => {
    try {
      await batchesApi.create(payload);
      await get().loadBatches();
      await get().loadPlants();
      return { success: true };
    } catch (err) {
      console.error('Ошибка создания партии:', err);

      let message = 'Не удалось создать партию';
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        message = err.response.data.error;
      }
      return { success: false, error: message };
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

  markGerminated: async (batchId) => {
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

  markPlantGerminated: async (plantId) => {
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
      await plantsApi.transplant(id, {
        to_container_id,
        to_cell_index,
        notes,
      });
      // Перезагружаем полностью — это гарантирует актуальные container_name
      // и корректный подсчёт растений в контейнерах.
      await get().loadPlants();
      await get().loadBatches();
      return true;
    } catch (err) {
      console.error('Ошибка пересадки:', err);
      return false;
    }
  },

  setPlantStatus: async (id, status) => {
    try {
      const updated = await plantsApi.setStatus(id, status);
      set({
        plants: get().plants.map((p) =>
          p.id === id ? { ...p, ...updated } : p
        ),
      });
      // Смена статуса пишет событие в историю — обновляем её, если
      // панель этого растения открыта.
      if (get().eventsLoadedFor === id) {
        await get().loadPlantWithEvents(id);
      }
      return true;
    } catch (err) {
      console.error('Ошибка смены статуса:', err);
      return false;
    }
  },

  removePlant: async (id) => {
    try {
      await plantsApi.remove(id);
      set({
        plants: get().plants.filter((p) => p.id !== id),
      });
      return true;
    } catch (err) {
      console.error('Ошибка удаления растения:', err);
      return false;
    }
  },

  addPlantEvent: async (plantId, eventType, notes) => {
    try {
      await plantsApi.addEvent(plantId, { event_type: eventType, notes });
      // Перезагружаем растение с историей
      await get().loadPlantWithEvents(plantId);
      return true;
    } catch (err) {
      console.error('Ошибка добавления события:', err);
      return false;
    }
  },

  loadPlantWithEvents: async (id) => {
    try {
      const data = await plantsApi.getOne(id);
      set({
        eventsLoadedFor: id,
        plants: get().plants.map((p) =>
          p.id === id ? { ...p, events: data.events } : p
        ),
      });
      return data;
    } catch (err) {
      console.error('Ошибка загрузки растения с событиями:', err);
      return null;
    }
  },

  closePlantEvents: () => {
    set({ eventsLoadedFor: null });
  },
}));
