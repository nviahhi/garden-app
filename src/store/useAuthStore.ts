import { create } from 'zustand';
import { authApi, type AuthUser } from '../api/auth';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  init: () => Promise<void>;
  signup: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const TOKEN_KEY = 'garden-token';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  isLoading: true,

  init: async () => {
    const token = localStorage.getItem(TOKEN_KEY);

    // Нет токена → создаём гостя
    if (!token) {
      try {
        const { token: t, user } = await authApi.guest();
        localStorage.setItem(TOKEN_KEY, t);
        set({ token: t, user, isLoading: false });
      } catch (err) {
        console.error('Ошибка создания гостя:', err);
        set({ isLoading: false });
      }
      return;
    }

    // Есть токен → проверяем
    try {
      const user = await authApi.me();
      set({ user, isLoading: false });
    } catch {
      // Токен протух → создаём нового гостя
      try {
        const { token: t, user } = await authApi.guest();
        localStorage.setItem(TOKEN_KEY, t);
        set({ token: t, user, isLoading: false });
      } catch {
        set({ isLoading: false });
      }
    }
  },

  signup: async (email, password) => {
    try {
      const { token, user } = await authApi.signup(email, password);
      localStorage.setItem(TOKEN_KEY, token);
      set({ token, user });
      return { success: true };
    } catch (err) {
      let message = 'Не удалось создать аккаунт';
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        message = axiosErr.response?.data?.error ?? message;
      }
      return { success: false, error: message };
    }
  },

  login: async (email, password) => {
    try {
      const { token, user } = await authApi.login(email, password);
      localStorage.setItem(TOKEN_KEY, token);
      set({ token, user });
      return { success: true };
    } catch (err) {
      let message = 'Неверный email или пароль';
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        message = axiosErr.response?.data?.error ?? message;
      }
      return { success: false, error: message };
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ user: null, token: null });
    // Перезагружаем — init() создаст нового гостя
    window.location.reload();
  },
}));