import client from './client';
import type { Zone, ZoneShelf, ZoneType } from '../types';

export interface CreateZonePayload {
  name: string;
  type: ZoneType;
  background_color?: string;
  grid_size?: number;
  width_cm: number;
  depth_cm: number;
  shelf_count?: number;
  shelves?: Partial<ZoneShelf>[];
}

export const zonesApi = {
  getAll: async (): Promise<Zone[]> => {
    const { data } = await client.get('/zones');
    return data;
  },

  getOne: async (id: number): Promise<Zone> => {
    const { data } = await client.get(`/zones/${id}`);
    return data;
  },

  create: async (payload: CreateZonePayload): Promise<Zone> => {
    const { data } = await client.post('/zones', payload);
    return data;
  },

  update: async (id: number, payload: Partial<CreateZonePayload>): Promise<Zone> => {
    const { data } = await client.put(`/zones/${id}`, payload);
    return data;
  },

  remove: async (id: number): Promise<void> => {
    await client.delete(`/zones/${id}`);
  },
};