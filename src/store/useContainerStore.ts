import { create } from 'zustand';
import { containersApi } from '../api/containers';
import type { Container } from '../types';

interface ContainerState {
  containers: Container[];
  isLoading: boolean;
  error: string | null;

  loadContainers: () => Promise<void>;
  addContainer: (data: Partial<Container>) => Promise<Container | null>;
  updateContainer: (id: number, data: Partial<Container>) => Promise<void>;
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
      return created;
    } catch (err) {
      console.error('Ошибка создания:', err);
      return null;
    }
  },

  updateContainer: async (id, data) => {
    // Оптимистичное обновление — UI меняется мгновенно
    set({
      containers: get().containers.map((c) =>
        c.id === id ? { ...c, ...data } : c
      ),
    });

    try {
      await containersApi.update(id, data);
    } catch (err) {
      console.error('Ошибка обновления:', err);
    }
  },

  removeContainer: async (id) => {
    try {
      await containersApi.remove(id);
      set({ containers: get().containers.filter((c) => c.id !== id) });
    } catch (err) {
      console.error('Ошибка удаления:', err);
    }
  },
}));