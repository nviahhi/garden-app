const express = require('express');
const router = express.Router();
const pool = require('../db');

const PX_PER_CM_SHELF = 10;  // масштаб для стеллажа

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
      shelf_width_cm,
      shelf_depth_cm,
      shelf_count,
    } = req.body;

    if (!name || !type) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Обязательные поля: name, type' });
    }

    let finalCanvasWidth = canvas_width || 1200;
    let finalCanvasHeight = canvas_height || 800;
    let finalPxPerCm = px_per_cm || 20;

    // Для стеллажа — вычисляем канвас из реальных размеров
    if (
      type === 'shelf' &&
      shelf_width_cm &&
      shelf_depth_cm &&
      shelf_count
    ) {
      finalPxPerCm = PX_PER_CM_SHELF;
      finalCanvasWidth = shelf_width_cm * PX_PER_CM_SHELF;
      finalCanvasHeight = shelf_depth_cm * shelf_count * PX_PER_CM_SHELF;
    }

    const zoneResult = await client.query(`
      INSERT INTO zones (
        name, type, canvas_width, canvas_height, px_per_cm,
        background_color, grid_size,
        shelf_width_cm, shelf_depth_cm, shelf_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      name,
      type,
      finalCanvasWidth,
      finalCanvasHeight,
      finalPxPerCm,
      background_color || '#faf6ef',
      grid_size || 20,
      shelf_width_cm || null,
      shelf_depth_cm || null,
      shelf_count || null,
    ]);

    const zone = zoneResult.rows[0];

    // Генерация полок для стеллажа
    let createdShelves = [];
    if (
      type === 'shelf' &&
      shelf_count &&
      shelf_count > 0 &&
      shelf_depth_cm
    ) {
      const shelfHeightPx = Math.round(shelf_depth_cm * finalPxPerCm);

      for (let i = 0; i < shelf_count; i++) {
        const shelfResult = await client.query(`
          INSERT INTO zone_shelves (zone_id, name, y, height, color, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [
          zone.id,
          `Полка ${shelf_count - i}`,
          i * shelfHeightPx,
          shelfHeightPx,
          '#f5f0e6',
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

// PUT /api/zones/:id — обновить зону
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
      shelf_width_cm,
      shelf_depth_cm,
      shelf_count,
    } = req.body;

    const currentResult = await client.query(
      'SELECT * FROM zones WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Зона не найдена' });
    }

    const current = currentResult.rows[0];

    const effectiveType = type ?? current.type;
    const effectiveShelfWidth = shelf_width_cm ?? current.shelf_width_cm;
    const effectiveShelfDepth = shelf_depth_cm ?? current.shelf_depth_cm;
    const effectiveShelfCount = shelf_count ?? current.shelf_count;

    let finalCanvasWidth = canvas_width ?? current.canvas_width;
    let finalCanvasHeight = canvas_height ?? current.canvas_height;
    let finalPxPerCm = px_per_cm ?? current.px_per_cm;

    // Для стеллажа — вычисляем канвас из реальных размеров
    if (
      effectiveType === 'shelf' &&
      effectiveShelfWidth &&
      effectiveShelfDepth &&
      effectiveShelfCount
    ) {
      finalPxPerCm = PX_PER_CM_SHELF;
      finalCanvasWidth = effectiveShelfWidth * PX_PER_CM_SHELF;
      finalCanvasHeight = effectiveShelfDepth * effectiveShelfCount * PX_PER_CM_SHELF;
    }

    const zoneResult = await client.query(`
      UPDATE zones
      SET name = $1,
          type = $2,
          canvas_width = $3,
          canvas_height = $4,
          px_per_cm = $5,
          background_color = $6,
          grid_size = $7,
          shelf_width_cm = $8,
          shelf_depth_cm = $9,
          shelf_count = $10
      WHERE id = $11
      RETURNING *
    `, [
      name ?? current.name,
      effectiveType,
      finalCanvasWidth,
      finalCanvasHeight,
      finalPxPerCm,
      background_color ?? current.background_color,
      grid_size ?? current.grid_size,
      effectiveShelfWidth,
      effectiveShelfDepth,
      effectiveShelfCount,
      id,
    ]);

    const updatedZone = zoneResult.rows[0];

    // Пересоздаём полки для стеллажа
    if (updatedZone.type === 'shelf') {
      await client.query('DELETE FROM zone_shelves WHERE zone_id = $1', [id]);

      if (
        updatedZone.shelf_count > 0 &&
        updatedZone.shelf_depth_cm &&
        updatedZone.px_per_cm
      ) {
        const shelfHeightPx = Math.round(
          updatedZone.shelf_depth_cm * updatedZone.px_per_cm
        );

        for (let i = 0; i < updatedZone.shelf_count; i++) {
          await client.query(`
            INSERT INTO zone_shelves (zone_id, name, y, height, color, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            id,
            `Полка ${updatedZone.shelf_count - i}`,
            i * shelfHeightPx,
            shelfHeightPx,
            '#f5f0e6',
            i,
          ]);
        }
      }
    }

    await client.query('COMMIT');

    const shelvesResult = await pool.query(
      'SELECT * FROM zone_shelves WHERE zone_id = $1 ORDER BY y ASC',
      [id]
    );

    res.json({
      ...updatedZone,
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

// DELETE /api/zones/:id
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