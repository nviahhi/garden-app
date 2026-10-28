import { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';

interface AuthModalProps {
  initialMode: 'login' | 'signup';
  onClose: () => void;
}

export function AuthModal({ initialMode, onClose }: AuthModalProps) {
  const signup = useAuthStore((s) => s.signup);
  const login = useAuthStore((s) => s.login);
  const user = useAuthStore((s) => s.user);

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isConvert = mode === 'signup' && user?.isAnonymous;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result =
      mode === 'login'
        ? await login(email, password)
        : await signup(email, password);

    setLoading(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error ?? 'Ошибка');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 420 }}>
        <div className="panel-header">
          <h3>
            {isConvert
              ? 'Сохранить прогресс'
              : mode === 'login'
              ? 'Вход'
              : 'Создать аккаунт'}
          </h3>
          <button className="btn-icon" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        {isConvert && (
          <p className="auth-hint">
            Создайте аккаунт — все ваши зоны, контейнеры и растения
            сохранятся и будут доступны с любого устройства.
          </p>
        )}

        <form className="container-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email *</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
              autoComplete="email"
            />
          </label>

          <label className="field">
            <span>Пароль *</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 6 символов"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !email || !password}
            >
              {loading
                ? '...'
                : isConvert
                ? 'Сохранить прогресс'
                : mode === 'login'
                ? 'Войти'
                : 'Создать аккаунт'}
            </button>
          </div>

          <div className="auth-switch">
            {mode === 'login' ? (
              <button
                type="button"
                className="welcome-link"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
              >
                Нет аккаунта? Создать
              </button>
            ) : (
              <button
                type="button"
                className="welcome-link"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
              >
                Уже есть аккаунт? Войти
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}