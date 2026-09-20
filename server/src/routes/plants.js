const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/plants — список растений с фильтрами
// Query: ?container_id=1&batch_id=2&status=growing
router.get('/', async (req, res) => {
  try {
    const { container_id, batch_id, status } = req.query;

    const conditions = [];
    const params = [];

    if (container_id) {
      params.push(container_id);
      conditions.push(`p.container_id = $${params.length}`);
    }
    if (batch_id) {
      params.push(batch_id);
      conditions.push(`p.batch_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`p.status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT 
        p.*,
        b.species,
        b.variety,
        b.sowing_date,
        c.name AS container_name,
        c.type AS container_type
      FROM plants p
      JOIN batches b ON b.id = p.batch_id
      LEFT JOIN containers c ON c.id = p.container_id
      ${where}
      ORDER BY p.id
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения растений' });
  }
});

// GET /api/plants/:id — одно растение с историей
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const plantResult = await pool.query(`
      SELECT p.*, b.species, b.variety, b.sowing_date,
             c.name AS container_name, c.type AS container_type
      FROM plants p
      JOIN batches b ON b.id = p.batch_id
      LEFT JOIN containers c ON c.id = p.container_id
      WHERE p.id = $1
    `, [id]);

    if (plantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Растение не найдено' });
    }

    const eventsResult = await pool.query(`
      SELECT e.*,
             fc.name AS from_container_name,
             tc.name AS to_container_name
      FROM plant_events e
      LEFT JOIN containers fc ON fc.id = e.from_container_id
      LEFT JOIN containers tc ON tc.id = e.to_container_id
      WHERE e.plant_id = $1
      ORDER BY e.event_date DESC, e.id DESC
    `, [id]);

    res.json({
      ...plantResult.rows[0],
      events: eventsResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения растения' });
  }
});

// POST /api/plants — создать одно растение вручную
router.post('/', async (req, res) => {
  try {
    const { batch_id, container_id, cell_index, number, status, notes } = req.body;

    if (!batch_id || !number) {
      return res.status(400).json({ error: 'Обязательные поля: batch_id, number' });
    }

    const result = await pool.query(`
      INSERT INTO plants (batch_id, container_id, cell_index, number, status, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      batch_id,
      container_id || null,
      cell_index ?? null,
      number,
      status || 'seedling',
      notes || null,
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания растения' });
  }
});

// PUT /api/plants/:id/transplant — пересадка растения
// Body: { to_container_id, to_cell_index?, notes? }
router.put('/:id/transplant', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { to_container_id, to_cell_index, notes } = req.body;

    if (!to_container_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Поле to_container_id обязательно' });
    }

    // Получаем текущее состояние растения
    const currentResult = await client.query(
      'SELECT * FROM plants WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Растение не найдено' });
    }

    const current = currentResult.rows[0];

    // Пишем событие пересадки
    await client.query(`
      INSERT INTO plant_events 
        (plant_id, event_type, event_date, from_container_id, from_cell_index,
         to_container_id, to_cell_index, notes)
      VALUES ($1, 'transplant', CURRENT_DATE, $2, $3, $4, $5, $6)
    `, [
      id,
      current.container_id,
      current.cell_index,
      to_container_id,
      to_cell_index ?? null,
      notes || null,
    ]);

    // Обновляем растение
    const updatedResult = await client.query(`
      UPDATE plants
      SET container_id = $1,
          cell_index = $2,
          status = 'transplanted',
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [to_container_id, to_cell_index ?? null, id]);

    await client.query('COMMIT');

    res.json(updatedResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ошибка пересадки растения' });
  } finally {
    client.release();
  }
});

// PUT /api/plants/:id/status — сменить статус (собрано, погибло и т.д.)
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['seedling', 'growing', 'transplanted', 'harvested', 'dead'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status должен быть одним из: ${allowed.join(', ')}` });
    }

    const result = await pool.query(`
      UPDATE plants
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Растение не найдено' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка смены статуса' });
  }
});

// POST /api/plants/:id/events — добавить событие (заметка, замер)
router.post('/:id/events', async (req, res) => {
  try {
    const { id } = req.params;
    const { event_type, event_date, notes } = req.body;

    if (!event_type || !notes) {
      return res.status(400).json({ error: 'Обязательные поля: event_type, notes' });
    }

    const result = await pool.query(`
      INSERT INTO plant_events (plant_id, event_type, event_date, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [id, event_type, event_date || new Date(), notes]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания события' });
  }
});

// DELETE /api/plants/:id — удалить растение
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM plants WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Растение не найдено' });
    }
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления растения' });
  }
});

module.exports = router;