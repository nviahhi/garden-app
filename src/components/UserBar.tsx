import { useAuthStore } from '../store/useAuthStore';

export function UserBar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

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
        onClick={logout}
        title="Выйти из аккаунта"
      >
        Выйти
      </button>
    </div>
  );
}