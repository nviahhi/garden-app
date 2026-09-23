import axios from 'axios';
import type { Batch, Plant } from '../types';

const api = axios.create({ baseURL: '/api' });

export interface CreateBatchPayload {
  species: string;
  variety?: string;
  sowing_date: string;
  seeds_count: number;
  container_id?: number;
  cell_indices?: number[];
  container_ids?: number[];      // ← группа горшков
  notes?: string;
}

export interface BatchWithPlants extends Batch {
  plants: Plant[];
}

export const batchesApi = {
  getAll: async (): Promise<Batch[]> => {
    const { data } = await api.get('/batches');
    return data;
  },

  getOne: async (id: number): Promise<BatchWithPlants> => {
    const { data } = await api.get(`/batches/${id}`);
    return data;
  },

  create: async (payload: CreateBatchPayload): Promise<BatchWithPlants> => {
    const { data } = await api.post('/batches', payload);
    return data;
  },

  germinate: async (id: number, count: number): Promise<{ created: number; plants: Plant[] }> => {
    const { data } = await api.post(`/batches/${id}/germinate`, { count });
    return data;
  },

  markGerminated: async (id: number): Promise<{ updated: number; plants: Plant[] }> => {
    const { data } = await api.put(`/batches/${id}/mark-germinated`);
    return data;
  },

  remove: async (id: number): Promise<void> => {
    await api.delete(`/batches/${id}`);
  },
};