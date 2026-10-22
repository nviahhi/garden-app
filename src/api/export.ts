import axios from 'axios';
import type { Plant } from '../types';

const api = axios.create({ baseURL: '/api' });

export const exportApi = {
  // Все растения (все зоны, все партии)
  plantsAll: async (): Promise<Plant[]> => {
    const { data } = await api.get('/export/plants');
    return data;
  },

  // Растения конкретной зоны
  plantsByZone: async (zoneId: number): Promise<Plant[]> => {
    const { data } = await api.get('/export/plants', {
      params: { zone_id: zoneId },
    });
    return data;
  },

  // Растения конкретной партии
  plantsByBatch: async (batchId: number): Promise<Plant[]> => {
    const { data } = await api.get('/export/plants', {
      params: { batch_id: batchId },
    });
    return data;
  },
};