import client from './client';
import type { Stats } from '../types';

export const statsApi = {
  get: async (since?: string): Promise<Stats> => {
    const { data } = await client.get('/stats', {
      params: since ? { since } : undefined,
    });
    return data;
  },
};