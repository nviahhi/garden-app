import { create } from 'zustand';
import { containersApi } from '../api/containers';
import type { Container } from '../types';

interface ContainerState {
  containers: Container[];
  isLoading: boolean;
  error: string | null;

  loadContainers: () => Promise<void>;
  addContainer: (data: Partial<Container>) => Promise<void>;
  moveContainer: (id: number, x: number, y: number) => Promise<void>;
  removeContainer: (id: number) => Promise<void>;
}

export const useContainerStore = create<ContainerState>((set, get) => ({
  containers: [],
  isLoading: false,
  error: null,

  loadContainers: async () => {
    set({ isLoading: true, error: null });
    try {
      const containers = await containersApi.getAll();
      set({ containers, isLoading: false });
    } catch (err) {
      set({ error: 'Ошибка загрузки контейнеров', isLoading: false });
      console.error(err);
    }
  },

  addContainer: async (data) => {
    try {
      const created = await containersApi.create(data);
      set({ containers: [...get().containers, created] });
    } catch (err) {
      console.error(err);
    }
  },

  moveContainer: async (id, x, y) => {
    // 1. Оптимистичное обновление UI (мгновенно)
    set({
      containers: get().containers.map((c) =>
        c.id === id ? { ...c, x, y } : c
      ),
    });

    // 2. Отправка на сервер (в фоне)
    try {
      await containersApi.update(id, { x, y });
    } catch (err) {
      console.error('Ошибка сохранения позиции:', err);
      // При ошибке можно откатить — но для MVP пропустим
    }
  },

  removeContainer: async (id) => {
    try {
      await containersApi.remove(id);
      set({ containers: get().containers.filter((c) => c.id !== id) });
    } catch (err) {
      console.error(err);
    }
  },
}));