const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/plants — с фильтрами
router.get('/', async (req, res) => {
  try {
    const { container_id, batch_id, status } = req.query;

    const conditions = ['p.user_id = $1'];
    const params = [req.user.id];

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

    const where = `WHERE ${conditions.join(' AND ')}`;

    const result = await pool.query(`
      SELECT 
        p.*,
        b.species, b.variety, b.sowing_date,
        c.name AS container_name, c.type AS container_type
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

// GET /api/plants/:id — с историей
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const plantResult = await pool.query(`
      SELECT p.*, b.species, b.variety, b.sowing_date,
             c.name AS container_name, c.type AS container_type
      FROM plants p
      JOIN batches b ON b.id = p.batch_id
      LEFT JOIN containers c ON c.id = p.container_id
      WHERE p.id = $1 AND p.user_id = $2
    `, [id, req.user.id]);

    if (plantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Растение не найдено' });
    }

    const eventsResult = await pool.query(`
      SELECT e.*,
             fc.name AS from_container_name,
             tc.name AS to_container_name,
             fz.name AS from_zone_name,
             tz.name AS to_zone_name
      FROM plant_events e
      LEFT JOIN containers fc ON fc.id = e.from_container_id
      LEFT JOIN containers tc ON tc.id = e.to_container_id
      LEFT JOIN zones fz ON fz.id = fc.zone_id
      LEFT JOIN zones tz ON tz.id = tc.zone_id
      WHERE e.plant_id = $1 AND e.user_id = $2
      ORDER BY e.event_date DESC, e.id DESC
    `, [id, req.user.id]);

    res.json({ ...plantResult.rows[0], events: eventsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения растения' });
  }
});

// POST /api/plants — создать вручную
router.post('/', async (req, res) => {
  try {
    const { batch_id, container_id, cell_index, number, status, notes } = req.body;

    if (!batch_id || !number) {
      return res.status(400).json({ error: 'Обязательные поля: batch_id, number' });
    }

    const batchCheck = await pool.query(
      'SELECT id FROM batches WHERE id = $1 AND user_id = $2',
      [batch_id, req.user.id]
    );
    if (batchCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Партия недоступна' });
    }

    // Сквозной номер в рамках юзера
    const maxRes = await pool.query(
      'SELECT COALESCE(MAX(display_number), 0)::int AS max FROM plants WHERE user_id = $1',
      [req.user.id]
    );
    const displayNumber = maxRes.rows[0].max + 1;

    const result = await pool.query(`
      INSERT INTO plants (batch_id, container_id, cell_index, number, status, notes, display_number, user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      batch_id, container_id || null, cell_index ?? null, number,
      status || 'sown', notes || null, displayNumber, req.user.id,
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания растения' });
  }
});

// PUT /api/plants/:id/transplant
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

    const currentResult = await client.query(
      'SELECT * FROM plants WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Растение не найдено' });
    }
    const current = currentResult.rows[0];

    // Проверка целевого контейнера
    const targetContainerResult = await client.query(
      'SELECT * FROM containers WHERE id = $1 AND user_id = $2',
      [to_container_id, req.user.id]
    );
    if (targetContainerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Контейнер недоступен' });
    }
    const container = targetContainerResult.rows[0];

    let finalCellIndex = to_cell_index ?? null;

    // Автоподбор свободной ячейки
    if (finalCellIndex == null && container.cols && container.rows) {
      const totalCells = container.cols * container.rows;

      const occupied = await client.query(`
        SELECT cell_index FROM plants
        WHERE container_id = $1 AND user_id = $2 AND cell_index IS NOT NULL AND id != $3
      `, [to_container_id, req.user.id, id]);

      const occupiedSet = new Set(occupied.rows.map((r) => r.cell_index));

      let freeCell = null;
      for (let i = 0; i < totalCells; i++) {
        if (!occupiedSet.has(i)) {
          freeCell = i;
          break;
        }
      }

      if (freeCell == null) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'В этой кассете нет свободных ячеек' });
      }
      finalCellIndex = freeCell;
    } else if (finalCellIndex != null) {
      const conflict = await client.query(`
        SELECT id FROM plants
        WHERE container_id = $1 AND user_id = $2 AND cell_index = $3 AND id != $4
      `, [to_container_id, req.user.id, finalCellIndex, id]);

      if (conflict.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Ячейка #${finalCellIndex + 1} уже занята` });
      }
    }

    // Событие пересадки
    await client.query(`
      INSERT INTO plant_events 
        (plant_id, event_type, event_date, from_container_id, from_cell_index,
         to_container_id, to_cell_index, notes, user_id)
      VALUES ($1, 'transplant', CURRENT_DATE, $2, $3, $4, $5, $6, $7)
    `, [
      id,
      current.container_id,
      current.cell_index,
      to_container_id,
      finalCellIndex,
      notes || null,
      req.user.id,
    ]);

    await client.query(`
      UPDATE plants
      SET container_id = $1, cell_index = $2, updated_at = NOW()
      WHERE id = $3 AND user_id = $4
    `, [to_container_id, finalCellIndex, id, req.user.id]);

    const fullResult = await client.query(`
      SELECT p.*, b.species, b.variety, b.sowing_date,
             c.name AS container_name, c.type AS container_type
      FROM plants p
      JOIN batches b ON b.id = p.batch_id
      LEFT JOIN containers c ON c.id = p.container_id
      WHERE p.id = $1
    `, [id]);

    await client.query('COMMIT');
    res.json(fullResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ошибка пересадки растения' });
  } finally {
    client.release();
  }
});

// PUT /api/plants/:id/status
router.put('/:id/status', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['sown', 'growing', 'flowering', 'fruiting', 'done'];
    if (!allowed.includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `status должен быть одним из: ${allowed.join(', ')}`,
      });
    }

    const currentResult = await client.query(
      'SELECT * FROM plants WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Растение не найдено' });
    }
    const current = currentResult.rows[0];

    if (current.status === status) {
      await client.query('ROLLBACK');
      return res.json(current);
    }

    const updatedResult = await client.query(`
      UPDATE plants
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND user_id = $3
      RETURNING *
    `, [status, id, req.user.id]);

    await client.query(`
      INSERT INTO plant_events 
        (plant_id, event_type, event_date, from_status, to_status, notes, user_id)
      VALUES ($1, 'status_change', CURRENT_DATE, $2, $3, NULL, $4)
    `, [id, current.status, status, req.user.id]);

    await client.query('COMMIT');
    res.json(updatedResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ошибка смены статуса' });
  } finally {
    client.release();
  }
});

// POST /api/plants/:id/events
router.post('/:id/events', async (req, res) => {
  try {
    const { id } = req.params;
    const { event_type, event_date, notes } = req.body;

    if (!event_type || !notes) {
      return res.status(400).json({ error: 'Обязательные поля: event_type, notes' });
    }

    const plantCheck = await pool.query(
      'SELECT id FROM plants WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (plantCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Растение недоступно' });
    }

    const result = await pool.query(`
      INSERT INTO plant_events (plant_id, event_type, event_date, notes, user_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, event_type, event_date || new Date(), notes, req.user.id]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания события' });
  }
});

// DELETE /api/plants/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM plants WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
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