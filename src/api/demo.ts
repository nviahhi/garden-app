import client from './client';

export const demoApi = {
  seed: async (): Promise<void> => {
    await client.post('/demo/seed');
  },

  reset: async (): Promise<void> => {
    await client.delete('/demo');
  },
};