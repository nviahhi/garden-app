import client from './client';
import type { Batch, Plant } from '../types';

export interface CreateBatchPayload {
  species: string;
  variety?: string;
  sowing_date: string;
  seeds_count: number;
  container_id?: number;
  cell_indices?: number[];
  container_ids?: number[];
  notes?: string;
}

export interface BatchWithPlants extends Batch {
  plants: Plant[];
}

export const batchesApi = {
  getAll: async (): Promise<Batch[]> => {
    const { data } = await client.get('/batches');
    return data;
  },

  getOne: async (id: number): Promise<BatchWithPlants> => {
    const { data } = await client.get(`/batches/${id}`);
    return data;
  },

  create: async (payload: CreateBatchPayload): Promise<BatchWithPlants> => {
    const { data } = await client.post('/batches', payload);
    return data;
  },

  germinate: async (
    id: number,
    count: number
  ): Promise<{ created: number; plants: Plant[] }> => {
    const { data } = await client.post(`/batches/${id}/germinate`, { count });
    return data;
  },

  markGerminated: async (
    id: number
  ): Promise<{ updated: number; plants: Plant[] }> => {
    const { data } = await client.put(`/batches/${id}/mark-germinated`);
    return data;
  },

  remove: async (id: number): Promise<void> => {
    await client.delete(`/batches/${id}`);
  },
};