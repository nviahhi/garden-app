const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/containers — только свои (можно фильтровать по zone_id)
router.get('/', async (req, res) => {
  try {
    const { zone_id } = req.query;

    let query = 'SELECT * FROM containers WHERE user_id = $1';
    const params = [req.user.id];

    if (zone_id) {
      params.push(zone_id);
      query += ` AND zone_id = $${params.length}`;
    }

    query += ' ORDER BY id';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения контейнеров' });
  }
});

// GET /api/containers/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM containers WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
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

// POST /api/containers — создать
router.post('/', async (req, res) => {
  try {
    const { name, type, x, y, width, height, cols, rows, zone_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Поле name обязательно' });
    }

    // Если указана зона — проверяем, что она принадлежит юзеру
    if (zone_id) {
      const zoneCheck = await pool.query(
        'SELECT id FROM zones WHERE id = $1 AND user_id = $2',
        [zone_id, req.user.id]
      );
      if (zoneCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Зона недоступна' });
      }
    }

    const result = await pool.query(
      `INSERT INTO containers (name, type, x, y, width, height, cols, rows, zone_id, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
        req.user.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания контейнера' });
  }
});

// PUT /api/containers/:id — обновить
router.put('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { name, type, x, y, width, height, cols, rows, zone_id } = req.body;

    const currentResult = await client.query(
      'SELECT * FROM containers WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Контейнер не найден' });
    }

    const current = currentResult.rows[0];

    // Проверка новой зоны (если меняется)
    const newZoneId = zone_id !== undefined ? zone_id : current.zone_id;
    if (newZoneId && newZoneId !== current.zone_id) {
      const zoneCheck = await client.query(
        'SELECT id FROM zones WHERE id = $1 AND user_id = $2',
        [newZoneId, req.user.id]
      );
      if (zoneCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Зона недоступна' });
      }
    }

    let finalWidth = width ?? current.width;
    let finalHeight = height ?? current.height;
    let finalX = x ?? current.x;
    let finalY = y ?? current.y;

    // Пересчёт при смене зоны
    const zoneChanged =
      zone_id !== undefined &&
      zone_id !== null &&
      zone_id !== current.zone_id;

    if (zoneChanged) {
      const zonesResult = await client.query(
        'SELECT id, px_per_cm FROM zones WHERE id = ANY($1::int[]) AND user_id = $2',
        [[current.zone_id, zone_id].filter(Boolean), req.user.id]
      );

      const oldZone = zonesResult.rows.find((z) => z.id === current.zone_id);
      const newZone = zonesResult.rows.find((z) => z.id === zone_id);

      const oldPx = oldZone?.px_per_cm ?? 10;
      const newPx = newZone?.px_per_cm ?? 10;

      finalWidth = Math.round((finalWidth / oldPx) * newPx);
      finalHeight = Math.round((finalHeight / oldPx) * newPx);
      finalX = Math.round((finalX / oldPx) * newPx);
      finalY = Math.round((finalY / oldPx) * newPx);
    }

    const result = await client.query(
      `UPDATE containers 
       SET name = COALESCE($1, name),
           type = COALESCE($2, type),
           x = $3,
           y = $4,
           width = $5,
           height = $6,
           cols = COALESCE($7, cols),
           rows = COALESCE($8, rows),
           zone_id = COALESCE($9, zone_id),
           updated_at = NOW()
       WHERE id = $10 AND user_id = $11
       RETURNING *`,
      [
        name,
        type,
        finalX,
        finalY,
        finalWidth,
        finalHeight,
        cols,
        rows,
        zone_id,
        id,
        req.user.id,
      ]
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления контейнера' });
  } finally {
    client.release();
  }
});

// DELETE /api/containers/:id — с проверкой растений
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;

    const currentResult = await client.query(
      'SELECT * FROM containers WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Контейнер не найден' });
    }

    const plantsResult = await client.query(
      'SELECT COUNT(*)::int AS count FROM plants WHERE container_id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (plantsResult.rows[0].count > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `В контейнере ${plantsResult.rows[0].count} растений. Сначала пересадите их.`,
      });
    }

    await client.query(
      'DELETE FROM containers WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления контейнера' });
  } finally {
    client.release();
  }
});

module.exports = router;