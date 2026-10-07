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
      INSERT INTO plants (batch_id, container_id, cell_index, number, status, notes, display_number)
      VALUES ($1, $2, $3, $4, $5, $6, nextval('plants_display_number_seq'))
      RETURNING *
    `, [
      batch_id,
      container_id || null,
      cell_index ?? null,
      number,
      status || 'sown',
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

    // ===== Определяем финальный cell_index =====
    let finalCellIndex = to_cell_index ?? null;

    // Если целевой контейнер с сеткой и ячейка не указана — ищем первую свободную
    if (finalCellIndex == null) {
      const targetContainer = await client.query(
        'SELECT * FROM containers WHERE id = $1',
        [to_container_id]
      );

      const container = targetContainer.rows[0];
      const hasGrid = container?.cols && container?.rows;

      if (hasGrid) {
        const totalCells = container.cols * container.rows;

        // Занятые ячейки (кроме текущего растения)
        const occupied = await client.query(`
          SELECT cell_index FROM plants
          WHERE container_id = $1 AND cell_index IS NOT NULL AND id != $2
        `, [to_container_id, id]);

        const occupiedSet = new Set(occupied.rows.map((r) => r.cell_index));

        // Первая свободная ячейка
        let freeCell = null;
        for (let i = 0; i < totalCells; i++) {
          if (!occupiedSet.has(i)) {
            freeCell = i;
            break;
          }
        }

        if (freeCell == null) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'В этой кассете нет свободных ячеек',
          });
        }

        finalCellIndex = freeCell;
      }
    } else {
      // Пользователь указал ячейку явно — проверяем, что она свободна
      const conflict = await client.query(`
        SELECT id FROM plants
        WHERE container_id = $1 AND cell_index = $2 AND id != $3
      `, [to_container_id, finalCellIndex, id]);

      if (conflict.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Ячейка #${finalCellIndex + 1} уже занята`,
        });
      }
    }

    // ===== Пишем событие пересадки =====
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
      finalCellIndex,
      notes || null,
    ]);

    // ===== Обновляем растение — статус НЕ меняем =====
    const updatedResult = await client.query(`
      UPDATE plants
      SET container_id = $1,
          cell_index = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [to_container_id, finalCellIndex, id]);

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

// PUT /api/plants/:id/status — сменить статус растения
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
      'SELECT * FROM plants WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Растение не найдено' });
    }

    const current = currentResult.rows[0];

    // Если статус не меняется — ничего не делаем
    if (current.status === status) {
      await client.query('ROLLBACK');
      return res.json(current);
    }

    // Обновляем статус
    const updatedResult = await client.query(`
      UPDATE plants
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [status, id]);

    // Пишем событие в историю
    await client.query(`
      INSERT INTO plant_events 
        (plant_id, event_type, event_date, from_status, to_status, notes)
      VALUES ($1, 'status_change', CURRENT_DATE, $2, $3, NULL)
    `, [id, current.status, status]);

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