const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/zones — все зоны с количеством контейнеров
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        z.*,
        COUNT(c.id)::int AS containers_count
      FROM zones z
      LEFT JOIN containers c ON c.zone_id = z.id
      GROUP BY z.id
      ORDER BY z.sort_order, z.id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения зон' });
  }
});

// GET /api/zones/:id — зона + полки
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const zoneResult = await pool.query(
      'SELECT * FROM zones WHERE id = $1',
      [id]
    );

    if (zoneResult.rows.length === 0) {
      return res.status(404).json({ error: 'Зона не найдена' });
    }

    const shelvesResult = await pool.query(
      'SELECT * FROM zone_shelves WHERE zone_id = $1 ORDER BY y ASC',
      [id]
    );

    res.json({
      ...zoneResult.rows[0],
      shelves: shelvesResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения зоны' });
  }
});

// POST /api/zones — создать зону
// Body: { name, type, canvas_width?, canvas_height?, px_per_cm?, background_color?, grid_size? }
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      name,
      type,
      canvas_width,
      canvas_height,
      px_per_cm,
      background_color,
      grid_size,
      shelves,   // массив { name, y, height, color }
    } = req.body;

    if (!name || !type) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Обязательные поля: name, type' });
    }

    const zoneResult = await client.query(`
      INSERT INTO zones (name, type, canvas_width, canvas_height, px_per_cm, background_color, grid_size)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      name,
      type,
      canvas_width || 1200,
      canvas_height || 800,
      px_per_cm || 20,
      background_color || '#faf6ef',
      grid_size || 20,
    ]);

    const zone = zoneResult.rows[0];

    // Полки — только для типа 'shelf'
    let createdShelves = [];
    if (type === 'shelf' && Array.isArray(shelves) && shelves.length > 0) {
      for (let i = 0; i < shelves.length; i++) {
        const s = shelves[i];
        const shelfResult = await client.query(`
          INSERT INTO zone_shelves (zone_id, name, y, height, color, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [
          zone.id,
          s.name || `Полка ${i + 1}`,
          s.y ?? 100 + i * 220,
          s.height || 200,
          s.color || '#f5f0e6',
          i,
        ]);
        createdShelves.push(shelfResult.rows[0]);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      ...zone,
      shelves: createdShelves,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания зоны' });
  } finally {
    client.release();
  }
});

// PUT /api/zones/:id — обновить зону (с пересозданием полок)
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const {
      name,
      type,
      canvas_width,
      canvas_height,
      px_per_cm,
      background_color,
      grid_size,
      shelves,
    } = req.body;

    const zoneResult = await client.query(`
      UPDATE zones
      SET name = COALESCE($1, name),
          type = COALESCE($2, type),
          canvas_width = COALESCE($3, canvas_width),
          canvas_height = COALESCE($4, canvas_height),
          px_per_cm = COALESCE($5, px_per_cm),
          background_color = COALESCE($6, background_color),
          grid_size = COALESCE($7, grid_size)
      WHERE id = $8
      RETURNING *
    `, [
      name, type, canvas_width, canvas_height,
      px_per_cm, background_color, grid_size, id,
    ]);

    if (zoneResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Зона не найдена' });
    }

    // Если переданы shelves — пересоздаём
    if (Array.isArray(shelves)) {
      await client.query('DELETE FROM zone_shelves WHERE zone_id = $1', [id]);

      for (let i = 0; i < shelves.length; i++) {
        const s = shelves[i];
        await client.query(`
          INSERT INTO zone_shelves (zone_id, name, y, height, color, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          id,
          s.name || `Полка ${i + 1}`,
          s.y ?? 100 + i * 220,
          s.height || 200,
          s.color || '#f5f0e6',
          i,
        ]);
      }
    }

    await client.query('COMMIT');

    // Возвращаем обновлённую зону с полками
    const shelvesResult = await pool.query(
      'SELECT * FROM zone_shelves WHERE zone_id = $1 ORDER BY y ASC',
      [id]
    );

    res.json({
      ...zoneResult.rows[0],
      shelves: shelvesResult.rows,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления зоны' });
  } finally {
    client.release();
  }
});

// DELETE /api/zones/:id — удалить зону (каскадно удалит контейнеры)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM zones WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Зона не найдена' });
    }
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления зоны' });
  }
});

module.exports = router;