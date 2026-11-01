const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/season — дата начала сезона текущего пользователя
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT season_start FROM users WHERE id = $1',
      [req.user.id]
    );
    const { season_start } = result.rows[0];
    res.json({ season_start: season_start ?? null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения сезона' });
  }
});

// POST /api/season/start — начать новый сезон (сейчас)
router.post('/start', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE users
       SET season_start = NOW()
       WHERE id = $1
       RETURNING season_start`,
      [req.user.id]
    );
    res.json({ season_start: result.rows[0].season_start });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось начать сезон' });
  }
});

// POST /api/season/reset — сбросить сезон (показать все данные)
router.post('/reset', async (req, res) => {
  try {
    await pool.query(
      `UPDATE users SET season_start = NULL WHERE id = $1`,
      [req.user.id]
    );
    res.json({ season_start: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось сбросить сезон' });
  }
});

module.exports = router;
