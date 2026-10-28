const express = require('express');
const router = express.Router();
const pool = require('../db');

const PX_PER_CM = { shelf: 10, surface: 10, garden: 2 };

function calcCanvas(type, widthCm, depthCm, shelfCount) {
  const pxPerCm = PX_PER_CM[type] || 10;
  if (type === 'shelf') {
    const count = shelfCount || 1;
    return {
      canvasWidth: widthCm * pxPerCm,
      canvasHeight: depthCm * count * pxPerCm,
      pxPerCm,
    };
  }
  return {
    canvasWidth: widthCm * pxPerCm,
    canvasHeight: depthCm * pxPerCm,
    pxPerCm,
  };
}

// GET /api/zones — только свои
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT z.*, COUNT(c.id)::int AS containers_count
      FROM zones z
      LEFT JOIN containers c ON c.zone_id = z.id
      WHERE z.user_id = $1
      GROUP BY z.id
      ORDER BY z.sort_order, z.id
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения зон' });
  }
});

// GET /api/zones/:id — проверка владения
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const zoneResult = await pool.query(
      'SELECT * FROM zones WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (zoneResult.rows.length === 0) {
      return res.status(404).json({ error: 'Зона не найдена' });
    }
    const shelvesResult = await pool.query(
      'SELECT * FROM zone_shelves WHERE zone_id = $1 ORDER BY y ASC',
      [id]
    );
    res.json({ ...zoneResult.rows[0], shelves: shelvesResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения зоны' });
  }
});

// POST /api/zones — с user_id
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, type, background_color, grid_size, width_cm, depth_cm, shelf_count } = req.body;

    if (!name || !type || !width_cm || !depth_cm) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Заполните обязательные поля' });
    }

    const { canvasWidth, canvasHeight, pxPerCm } = calcCanvas(type, width_cm, depth_cm, shelf_count);

    const zoneResult = await client.query(`
      INSERT INTO zones (user_id, name, type, canvas_width, canvas_height, px_per_cm,
                         background_color, grid_size, width_cm, depth_cm, shelf_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      req.user.id, name, type, canvasWidth, canvasHeight, pxPerCm,
      background_color || '#faf6ef', grid_size || 20,
      width_cm, depth_cm, type === 'shelf' ? shelf_count : null,
    ]);

    const zone = zoneResult.rows[0];

    let createdShelves = [];
    if (type === 'shelf' && shelf_count > 0) {
      const shelfHeightPx = Math.round(depth_cm * pxPerCm);
      for (let i = 0; i < shelf_count; i++) {
        const shelfResult = await client.query(`
          INSERT INTO zone_shelves (zone_id, name, y, height, color, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `, [zone.id, `Полка ${shelf_count - i}`, i * shelfHeightPx, shelfHeightPx, '#f5f0e6', i]);
        createdShelves.push(shelfResult.rows[0]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ ...zone, shelves: createdShelves });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания зоны' });
  } finally {
    client.release();
  }
});

// PUT /api/zones/:id — проверка владения
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    const currentResult = await client.query(
      'SELECT * FROM zones WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Зона не найдена' });
    }

    const current = currentResult.rows[0];
    const { name, type, background_color, grid_size, width_cm, depth_cm, shelf_count } = req.body;

    const effectiveType = type ?? current.type;
    const effectiveWidthCm = width_cm ?? current.width_cm ?? 80;
    const effectiveDepthCm = depth_cm ?? current.depth_cm ?? 30;
    const effectiveShelfCount = shelf_count ?? current.shelf_count ?? 1;

    const { canvasWidth, canvasHeight, pxPerCm } = calcCanvas(
      effectiveType, effectiveWidthCm, effectiveDepthCm, effectiveShelfCount
    );

    const zoneResult = await client.query(`
      UPDATE zones SET name=$1, type=$2, canvas_width=$3, canvas_height=$4,
        px_per_cm=$5, background_color=$6, grid_size=$7, width_cm=$8, depth_cm=$9, shelf_count=$10
      WHERE id=$11 AND user_id=$12 RETURNING *
    `, [
      name ?? current.name, effectiveType, canvasWidth, canvasHeight, pxPerCm,
      background_color ?? current.background_color, grid_size ?? current.grid_size,
      effectiveWidthCm, effectiveDepthCm,
      effectiveType === 'shelf' ? effectiveShelfCount : null,
      id, req.user.id,
    ]);

    const updatedZone = zoneResult.rows[0];

    if (updatedZone.type === 'shelf') {
      await client.query('DELETE FROM zone_shelves WHERE zone_id = $1', [id]);
      if (updatedZone.shelf_count > 0) {
        const shelfHeightPx = Math.round(updatedZone.depth_cm * updatedZone.px_per_cm);
        for (let i = 0; i < updatedZone.shelf_count; i++) {
          await client.query(`
            INSERT INTO zone_shelves (zone_id, name, y, height, color, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [id, `Полка ${updatedZone.shelf_count - i}`, i * shelfHeightPx, shelfHeightPx, '#f5f0e6', i]);
        }
      }
    } else {
      await client.query('DELETE FROM zone_shelves WHERE zone_id = $1', [id]);
    }

    await client.query('COMMIT');
    const shelvesResult = await pool.query(
      'SELECT * FROM zone_shelves WHERE zone_id = $1 ORDER BY y ASC',
      [id]
    );
    res.json({ ...updatedZone, shelves: shelvesResult.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления зоны' });
  } finally {
    client.release();
  }
});

// DELETE /api/zones/:id — проверка владения
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM zones WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
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