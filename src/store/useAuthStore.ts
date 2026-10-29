import { create } from 'zustand';
import { authApi, type AuthUser } from '../api/auth';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;

  /** Только читает сохранённый токен. НЕ создаёт гостя. */
  init: () => Promise<void>;

  /** Создаёт гостя, если его ещё нет. Вызывается из welcome-кнопок. */
  ensureGuest: () => Promise<void>;

  signup: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const TOKEN_KEY = 'garden-token';

// Защита от двойного вызова init в StrictMode
let initPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  isLoading: true,

  init: () => {
    // Уже идёт — вернуть тот же промис
    if (initPromise) return initPromise;

    // Уже инициализировано — ничего не делать
    if (get().user && !get().isLoading) return Promise.resolve();

    initPromise = (async () => {
      const token = localStorage.getItem(TOKEN_KEY);

      // Токена нет → НЕ создаём гостя, просто показываем welcome
      if (!token) {
        set({ isLoading: false });
        return;
      }

      // Токен есть → проверяем его валидность
      try {
        const user = await authApi.me();
        set({ user, isLoading: false });
      } catch {
        // Токен протух / невалидный — забываем, показываем welcome
        localStorage.removeItem(TOKEN_KEY);
        set({ token: null, user: null, isLoading: false });
      }
    })();

    return initPromise;
  },

  ensureGuest: async () => {
    // Гость (или аккаунт) уже есть — ничего не делаем
    if (get().user) return;

    try {
      const { token, user } = await authApi.guest();
      localStorage.setItem(TOKEN_KEY, token);
      // Сбрасываем, чтобы следующий init() мог пересоздать при необходимости
      initPromise = null;
      set({ token, user, isLoading: false });
    } catch (err) {
      console.error('Ошибка создания гостя:', err);
      throw err;
    }
  },

  signup: async (email, password) => {
    try {
      const { token, user } = await authApi.signup(email, password);
      localStorage.setItem(TOKEN_KEY, token);
      initPromise = null;
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
      initPromise = null;
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
    initPromise = null;
    set({ user: null, token: null });
    window.location.reload();
  },
}));