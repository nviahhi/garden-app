import client from './client';
import type { Plant } from '../types';

export const exportApi = {
  // Все растения всех зон и партий
  plantsAll: async (): Promise<Plant[]> => {
    const { data } = await client.get('/export/plants');
    return data;
  },

  // Растения конкретной зоны
  plantsByZone: async (zoneId: number): Promise<Plant[]> => {
    const { data } = await client.get('/export/plants', {
      params: { zone_id: zoneId },
    });
    return data;
  },

  // Растения конкретной партии
  plantsByBatch: async (batchId: number): Promise<Plant[]> => {
    const { data } = await client.get('/export/plants', {
      params: { batch_id: batchId },
    });
    return data;
  },
};