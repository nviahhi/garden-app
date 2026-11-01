import client from './client';

export const seasonApi = {
  get: async (): Promise<{ season_start: string | null }> => {
    const { data } = await client.get('/season');
    return data;
  },

  start: async (): Promise<{ season_start: string }> => {
    const { data } = await client.post('/season/start');
    return data;
  },

  reset: async (): Promise<{ season_start: null }> => {
    const { data } = await client.post('/season/reset');
    return data;
  },
};
