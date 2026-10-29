import { useState } from 'react';
import { AuthModal } from './AuthModal';
import { useAuthStore } from '../store/useAuthStore';

interface WelcomeScreenProps {
  onStart: () => void;
  onDemo: () => Promise<void>;
}

export function WelcomeScreen({ onStart, onDemo }: WelcomeScreenProps) {
  const ensureGuest = useAuthStore((s) => s.ensureGuest);

  const [authModal, setAuthModal] = useState<'login' | 'signup' | null>(null);
  const [loading, setLoading] = useState<'start' | 'demo' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = loading !== null;

  const handleStart = async () => {
    setError(null);
    setLoading('start');
    try {
      await ensureGuest();   // ← гость создаётся только здесь
      onStart();
    } catch {
      setError('Не удалось создать сессию. Проверьте соединение и попробуйте снова.');
    } finally {
      setLoading(null);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setLoading('demo');
    try {
      await ensureGuest();   // ← гость создаётся только здесь
      await onDemo();
    } catch {
      setError('Не удалось загрузить демо-данные. Попробуйте ещё раз.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="welcome">
      <div className="welcome-content">
        <div className="welcome-icon">🌱</div>
        <h1>Журнал рассады</h1>
        <p className="welcome-subtitle">
          Личный учёт растений — от семечка до урожая. Создавайте зоны,
          добавляйте контейнеры, следите за каждым ростком, ведите историю
          пересадок и получайте статистику по сезону.
        </p>

        <div className="welcome-features">
          <div className="welcome-feature">
            <span className="welcome-feature-icon">🗄️</span>
            <div>
              <strong>Стеллаж, подоконник, огород</strong>
              <p>Разные зоны со своим масштабом, полками и контейнерами</p>
            </div>
          </div>

          <div className="welcome-feature">
            <span className="welcome-feature-icon">🌱</span>
            <div>
              <strong>Каждое растение под контролем</strong>
              <p>
                Сквозной номер, история статусов и пересадок,
                фотографии роста
              </p>
            </div>
          </div>

          <div className="welcome-feature">
            <span className="welcome-feature-icon">📊</span>
            <div>
              <strong>Статистика и экспорт</strong>
              <p>
                Всхожесть по сортам, распределение по статусам,
                поиск и PDF-отчёты
              </p>
            </div>
          </div>

          <div className="welcome-feature">
            <span className="welcome-feature-icon">✍️</span>
            <div>
              <strong>Заметки и наблюдения</strong>
              <p>
                Фиксируйте, что растёт лучше, что болеет, что стоит
                повторить в следующем сезоне
              </p>
            </div>
          </div>
        </div>

        <div className="welcome-actions">
          <button
            className="welcome-btn welcome-btn-primary"
            onClick={handleStart}
            disabled={busy}
          >
            <span className="welcome-btn-title">
              {loading === 'start'
                ? '⏳ Создаю сессию...'
                : 'Начать со своих данных'}
            </span>
            <span className="welcome-btn-hint">
              Создайте первую зону и контейнеры
            </span>
          </button>

          <button
            className="welcome-btn welcome-btn-secondary"
            onClick={handleDemo}
            disabled={busy}
          >
            <span className="welcome-btn-title">
              {loading === 'demo'
                ? '⏳ Загружаю демо...'
                : '✨ Посмотреть на демо-данных'}
            </span>
            <span className="welcome-btn-hint">
              3 зоны, 7 контейнеров, готовые растения
            </span>
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="welcome-footer">
          <button
            className="welcome-link"
            onClick={() => setAuthModal('login')}
            disabled={busy}
          >
            Уже есть аккаунт? Войти
          </button>
          <span className="welcome-footer-sep">·</span>
          <button
            className="welcome-link"
            onClick={() => setAuthModal('signup')}
            disabled={busy}
          >
            Создать аккаунт
          </button>
        </div>

        <div className="welcome-contact">
          <span className="welcome-beta-badge">Бета-версия</span>
          <p className="welcome-contact-text">
            Идеи, пожелания и баг-репорты пишите{' '}
            <a
              className="welcome-contact-link"
              href="mailto:nadja.viahhi@gmail.com?subject=Журнал%20рассады"
            >
              сюда
            </a>
            .
          </p>
        </div>
      </div>

      {authModal && (
        <AuthModal
          initialMode={authModal}
          onClose={() => setAuthModal(null)}
        />
      )}
    </div>
  );
}