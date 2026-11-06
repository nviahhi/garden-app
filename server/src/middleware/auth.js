const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-production';

async function authRequired(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  const token = authHeader.slice(7);

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }

  // Ошибки БД НЕ должны превращаться в 401 — иначе «недействительный токен»
  // маскирует недоступную базу и диагностику становится невозможной.
  let result;
  try {
    result = await pool.query(
      'SELECT id, email, is_anonymous FROM users WHERE id = $1',
      [payload.userId]
    );
  } catch (err) {
    console.error('authRequired: ошибка запроса к БД:', err.message);
    return res.status(503).json({ error: 'База данных недоступна' });
  }

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Пользователь не найден' });
  }

  const u = result.rows[0];
  req.user = {
    id: u.id,
    email: u.email,
    isAnonymous: u.is_anonymous,
  };

  // Обновляем last_seen (не блокируем)
  pool.query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [u.id])
    .catch(() => {});

  next();
}

module.exports = { authRequired };