import client from './client';
import type { Container } from '../types';

export const containersApi = {
  getAll: async (): Promise<Container[]> => {
    const { data } = await client.get('/containers');
    return data;
  },

  getOne: async (id: number): Promise<Container> => {
    const { data } = await client.get(`/containers/${id}`);
    return data;
  },

  create: async (container: Partial<Container>): Promise<Container> => {
    const { data } = await client.post('/containers', container);
    return data;
  },

  update: async (id: number, updates: Partial<Container>): Promise<Container> => {
    const { data } = await client.put(`/containers/${id}`, updates);
    return data;
  },

  remove: async (id: number): Promise<void> => {
    await client.delete(`/containers/${id}`);
  },
};