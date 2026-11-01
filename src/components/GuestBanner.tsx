import { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { AuthModal } from './AuthModal';

interface GuestBannerProps {
  onLogout: () => void;
}

export function GuestBanner({ onLogout }: GuestBannerProps) {
  const user = useAuthStore((s) => s.user);
  const [showAuth, setShowAuth] = useState(false);

  if (!user?.isAnonymous) return null;

  const handleLogout = () => {
    if (confirm('Выйти и начать заново? Текущие данные останутся в системе, но недоступны без токена.')) {
      onLogout();
    }
  };

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
        <button
          className="guest-banner-logout"
          onClick={handleLogout}
          title="Выйти и начать заново"
        >
          Выйти
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