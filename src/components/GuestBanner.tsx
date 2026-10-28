import { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { AuthModal } from './AuthModal';

export function GuestBanner() {
  const user = useAuthStore((s) => s.user);
  const [showAuth, setShowAuth] = useState(false);

  if (!user?.isAnonymous) return null;

  return (
    <>
      <div className="guest-banner">
        <span className="guest-banner-icon">💾</span>
        <span className="guest-banner-text">
          Прогресс не сохранён. Создайте аккаунт, чтобы не потерять данные.
        </span>
        <button
          className="guest-banner-btn"
          onClick={() => setShowAuth(true)}
        >
          Сохранить прогресс
        </button>
      </div>

      {showAuth && (
        <AuthModal
          initialMode="signup"
          onClose={() => setShowAuth(false)}
        />
      )}
    </>
  );
}