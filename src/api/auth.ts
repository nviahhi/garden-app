import client from './client';

export interface AuthUser {
  id: number;
  email: string | null;
  isAnonymous: boolean;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export const authApi = {
  guest: async (): Promise<AuthResponse> => {
    const { data } = await client.post('/auth/guest');
    return data;
  },

  signup: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await client.post('/auth/signup', { email, password });
    return data;
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await client.post('/auth/login', { email, password });
    return data;
  },

  me: async (): Promise<AuthUser> => {
    const { data } = await client.get('/auth/me');
    return data;
  },
};