import axios from 'axios';
import type { Container } from '../types';

const api = axios.create({
  baseURL: '/api',
});

export const containersApi = {
  getAll: async (): Promise<Container[]> => {
    const { data } = await api.get('/containers');
    return data;
  },

  getOne: async (id: number): Promise<Container> => {
    const { data } = await api.get(`/containers/${id}`);
    return data;
  },

  create: async (container: Partial<Container>): Promise<Container> => {
    const { data } = await api.post('/containers', container);
    return data;
  },

  update: async (id: number, updates: Partial<Container>): Promise<Container> => {
    const { data } = await api.put(`/containers/${id}`, updates);
    return data;
  },

  remove: async (id: number): Promise<void> => {
    await api.delete(`/containers/${id}`);
  },
};