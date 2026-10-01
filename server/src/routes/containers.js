const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/containers — все контейнеры (можно фильтровать по zone_id)
router.get('/', async (req, res) => {
  try {
    const { zone_id } = req.query;

    let query = 'SELECT * FROM containers';
    const params = [];

    if (zone_id) {
      query += ' WHERE zone_id = $1';
      params.push(zone_id);
    }

    query += ' ORDER BY id';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения контейнеров' });
  }
});

// GET /api/containers/:id — один контейнер
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM containers WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Контейнер не найден' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения контейнера' });
  }
});

// POST /api/containers — создать контейнер
router.post('/', async (req, res) => {
  try {
    const { name, type, x, y, width, height, cols, rows, zone_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Поле name обязательно' });
    }

    const result = await pool.query(
      `INSERT INTO containers (name, type, x, y, width, height, cols, rows, zone_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        name,
        type || 'pot',
        x || 0,
        y || 0,
        width || 80,
        height || 40,
        cols ?? null,
        rows ?? null,
        zone_id ?? null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания контейнера' });
  }
});

// PUT /api/containers/:id — обновить контейнер
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, x, y, width, height, cols, rows, zone_id } = req.body;

    const result = await pool.query(
      `UPDATE containers 
       SET name = COALESCE($1, name),
           type = COALESCE($2, type),
           x = COALESCE($3, x),
           y = COALESCE($4, y),
           width = COALESCE($5, width),
           height = COALESCE($6, height),
           cols = COALESCE($7, cols),
           rows = COALESCE($8, rows),
           zone_id = COALESCE($9, zone_id),
           updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [name, type, x, y, width, height, cols, rows, zone_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Контейнер не найден' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления контейнера' });
  }
});

// DELETE /api/containers/:id — удалить контейнер
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM containers WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Контейнер не найден' });
    }
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления контейнера' });
  }
});

module.exports = router;