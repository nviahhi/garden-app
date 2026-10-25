import axios from 'axios';
import type { Stats } from '../types';

const api = axios.create({ baseURL: '/api' });

export const statsApi = {
  get: async (): Promise<Stats> => {
    const { data } = await api.get('/stats');
    return data;
  },
};