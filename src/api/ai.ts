import client from './client';

export interface AiAnswer {
  answer: string;
}

export interface AiHistoryItem {
  role: 'user' | 'assistant';
  content: string;
  kind: 'analyze' | 'ask';
  age_sec: number;
}

export interface AiHistory {
  history: AiHistoryItem[];
}

export interface AiError {
  error: string;
}

export const aiApi = {
  analyze: async (): Promise<AiAnswer> => {
    const { data } = await client.get('/ai/analyze');
    return data;
  },

  ask: async (question: string): Promise<AiAnswer> => {
    const { data } = await client.post('/ai/ask', { question });
    return data;
  },

  history: async (): Promise<AiHistory> => {
    const { data } = await client.get('/ai/history');
    return data;
  },

  clearHistory: async (): Promise<void> => {
    await client.delete('/ai/history');
  },
};
