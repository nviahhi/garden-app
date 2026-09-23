import axios from 'axios';
import type { Plant, PlantEvent } from '../types';

const api = axios.create({ baseURL: '/api' });

export interface PlantWithEvents extends Plant {
  events: PlantEvent[];
}

export const plantsApi = {
  getAll: async (params?: {
    container_id?: number;
    batch_id?: number;
    status?: string;
  }): Promise<Plant[]> => {
    const { data } = await api.get('/plants', { params });
    return data;
  },

  getOne: async (id: number): Promise<PlantWithEvents> => {
    const { data } = await api.get(`/plants/${id}`);
    return data;
  },

  transplant: async (
    id: number,
    payload: { to_container_id: number; to_cell_index?: number; notes?: string }
  ): Promise<Plant> => {
    const { data } = await api.put(`/plants/${id}/transplant`, payload);
    return data;
  },

  markGerminated: async (id: number): Promise<Plant> => {
    const { data } = await api.put(`/plants/${id}/status`, { status: 'germinated' });
    return data;
  },

  setStatus: async (id: number, status: Plant['status']): Promise<Plant> => {
    const { data } = await api.put(`/plants/${id}/status`, { status });
    return data;
  },

  addEvent: async (
    id: number,
    payload: { event_type: string; event_date?: string; notes: string }
  ): Promise<PlantEvent> => {
    const { data } = await api.post(`/plants/${id}/events`, payload);
    return data;
  },

  remove: async (id: number): Promise<void> => {
    await api.delete(`/plants/${id}`);
  },
};