import { useAuthStore } from '../store/useAuthStore';

interface UserBarProps {
  onLogout: () => void;
}

export function UserBar({ onLogout }: UserBarProps) {
  const user = useAuthStore((s) => s.user);

  // Показываем только для зарегистрированных (не гостей)
  if (!user || user.isAnonymous || !user.email) return null;

  return (
    <div className="user-bar">
      <span className="user-bar-icon">👤</span>
      <span className="user-bar-email" title={user.email}>
        {user.email}
      </span>
      <button
        className="user-bar-logout"
        onClick={onLogout}
        title="Выйти из аккаунта"
      >
        Выйти
      </button>
    </div>
  );
}