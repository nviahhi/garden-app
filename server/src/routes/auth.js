const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authRequired } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-production';
const JWT_EXPIRES = '30d';

function makeToken(user) {
  return jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email ?? null,
    isAnonymous: u.is_anonymous,
  };
}

// POST /api/auth/guest — создать гостя
router.post('/guest', async (req, res) => {
  try {
    const result = await pool.query(
      `INSERT INTO users (is_anonymous) VALUES (true) RETURNING *`
    );
    const user = result.rows[0];
    res.json({
      token: makeToken(user),
      user: publicUser(user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось создать гостя' });
  }
});

// POST /api/auth/signup — регистрация (конвертирует гостя, если есть токен)
router.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Некорректный email' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
      email.toLowerCase().trim(),
    ]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Этот email уже используется' });
    }

    const hash = await bcrypt.hash(password, 10);

    // ===== Пытаемся конвертировать гостя =====
    let user = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
        const guestRes = await pool.query('SELECT * FROM users WHERE id = $1', [
          payload.userId,
        ]);
        const guest = guestRes.rows[0];

        if (guest && guest.is_anonymous) {
          const upd = await pool.query(
            `UPDATE users
             SET email = $1, password_hash = $2, is_anonymous = false
             WHERE id = $3
             RETURNING *`,
            [email.toLowerCase().trim(), hash, guest.id]
          );
          user = upd.rows[0];
        }
      } catch (e) {
        // Токен невалидный — просто создаём нового пользователя
      }
    }

    // ===== Если конвертировать не удалось — создаём нового =====
    if (!user) {
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, is_anonymous)
         VALUES ($1, $2, false)
         RETURNING *`,
        [email.toLowerCase().trim(), hash]
      );
      user = result.rows[0];
    }

    res.json({
      token: makeToken(user),
      user: publicUser(user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось создать аккаунт' });
  }
});

// POST /api/auth/login — вход
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Введите email и пароль' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = result.rows[0];

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    res.json({
      token: makeToken(user),
      user: publicUser(user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

// GET /api/auth/me — текущий пользователь
router.get('/me', authRequired, async (req, res) => {
  res.json(req.user);
});

// POST /api/auth/logout — заглушка (JWT на клиенте)
router.post('/logout', authRequired, async (req, res) => {
  res.json({ success: true });
});

module.exports = router;