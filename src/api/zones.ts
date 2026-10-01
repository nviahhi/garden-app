import axios from 'axios';
import type { Zone, ZoneShelf, ZoneType } from '../types';

const api = axios.create({ baseURL: '/api' });

export interface CreateZonePayload {
  name: string;
  type: ZoneType;
  canvas_width?: number;
  canvas_height?: number;
  px_per_cm?: number;
  background_color?: string;
  grid_size?: number;
  shelves?: Partial<ZoneShelf>[];
}

export const zonesApi = {
  getAll: async (): Promise<Zone[]> => {
    const { data } = await api.get('/zones');
    return data;
  },

  getOne: async (id: number): Promise<Zone> => {
    const { data } = await api.get(`/zones/${id}`);
    return data;
  },

  create: async (payload: CreateZonePayload): Promise<Zone> => {
    const { data } = await api.post('/zones', payload);
    return data;
  },

  update: async (id: number, payload: Partial<CreateZonePayload>): Promise<Zone> => {
    const { data } = await api.put(`/zones/${id}`, payload);
    return data;
  },

  remove: async (id: number): Promise<void> => {
    await api.delete(`/zones/${id}`);
  },
};