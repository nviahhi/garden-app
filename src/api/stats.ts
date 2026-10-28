import client from './client';
import type { Stats } from '../types';

export const statsApi = {
  get: async (): Promise<Stats> => {
    const { data } = await client.get('/stats');
    return data;
  },
};