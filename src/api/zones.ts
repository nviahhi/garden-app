import axios from 'axios';
import type { Zone, ZoneType } from '../types';

const api = axios.create({ baseURL: '/api' });

export interface CreateZonePayload {
  name: string;
  type: ZoneType;
  background_color?: string;
  grid_size?: number;
  width_cm: number;
  depth_cm: number;
  shelf_count?: number;
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