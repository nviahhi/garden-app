import client from './client';
import type { Plant, PlantEvent } from '../types';

export interface PlantWithEvents extends Plant {
  events: PlantEvent[];
}

export const plantsApi = {
  getAll: async (params?: {
    container_id?: number;
    batch_id?: number;
    status?: string;
  }): Promise<Plant[]> => {
    const { data } = await client.get('/plants', { params });
    return data;
  },

  getOne: async (id: number): Promise<PlantWithEvents> => {
    const { data } = await client.get(`/plants/${id}`);
    return data;
  },

  transplant: async (
    id: number,
    payload: { to_container_id: number; to_cell_index?: number; notes?: string }
  ): Promise<Plant> => {
    const { data } = await client.put(`/plants/${id}/transplant`, payload);
    return data;
  },

  setStatus: async (id: number, status: Plant['status']): Promise<Plant> => {
    const { data } = await client.put(`/plants/${id}/status`, { status });
    return data;
  },

  markGerminated: async (id: number): Promise<Plant> => {
    const { data } = await client.put(`/plants/${id}/status`, { status: 'growing' });
    return data;
  },

  addEvent: async (
    id: number,
    payload: { event_type: string; event_date?: string; notes: string }
  ): Promise<PlantEvent> => {
    const { data } = await client.post(`/plants/${id}/events`, payload);
    return data;
  },

  remove: async (id: number): Promise<void> => {
    await client.delete(`/plants/${id}`);
  },
};