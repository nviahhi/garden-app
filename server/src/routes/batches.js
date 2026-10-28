const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/batches
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        b.*,
        c.name AS container_name,
        c.type AS container_type,
        COUNT(p.id)::int AS plants_count
      FROM batches b
      LEFT JOIN containers c ON c.id = b.container_id
      LEFT JOIN plants p ON p.batch_id = b.id
      WHERE b.user_id = $1
      GROUP BY b.id, c.name, c.type
      ORDER BY b.sowing_date DESC, b.id DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения партий' });
  }
});

// GET /api/batches/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const batchResult = await pool.query(`
      SELECT b.*, c.name AS container_name, c.type AS container_type
      FROM batches b
      LEFT JOIN containers c ON c.id = b.container_id
      WHERE b.id = $1 AND b.user_id = $2
    `, [id, req.user.id]);

    if (batchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Партия не найдена' });
    }

    const plantsResult = await pool.query(`
      SELECT p.*, c.name AS container_name, c.type AS container_type
      FROM plants p
      LEFT JOIN containers c ON c.id = p.container_id
      WHERE p.batch_id = $1 AND p.user_id = $2
      ORDER BY p.number
    `, [id, req.user.id]);

    res.json({ ...batchResult.rows[0], plants: plantsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения партии' });
  }
});

// POST /api/batches
router.post('/', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      species, variety, sowing_date, seeds_count,
      container_id, cell_indices, container_ids, notes,
    } = req.body;

    if (!species || !sowing_date || !seeds_count) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Обязательные поля: species, sowing_date, seeds_count',
      });
    }

    // Валидация контейнера
    if (container_id) {
      const c = await client.query(
        'SELECT id FROM containers WHERE id = $1 AND user_id = $2',
        [container_id, req.user.id]
      );
      if (c.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Контейнер недоступен' });
      }
    }

    if (Array.isArray(container_ids) && container_ids.length > 0) {
      const c = await client.query(
        'SELECT id FROM containers WHERE id = ANY($1::int[]) AND user_id = $2',
        [container_ids, req.user.id]
      );
      if (c.rows.length !== container_ids.length) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Один из контейнеров недоступен' });
      }
    }

    let batchContainerId = container_id || null;
    if (Array.isArray(container_ids) && container_ids.length === 1) {
      batchContainerId = container_ids[0];
    }

    const batchResult = await client.query(
      `INSERT INTO batches (species, variety, sowing_date, seeds_count, container_id, notes, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [species, variety || null, sowing_date, seeds_count, batchContainerId, notes || null, req.user.id]
    );

    const batch = batchResult.rows[0];
    let createdPlants = [];

    // ===== Общий максимум display_number для юзера =====
    const maxDisplayResult = await client.query(
      'SELECT COALESCE(MAX(display_number), 0)::int AS max FROM plants WHERE user_id = $1',
      [req.user.id]
    );
    const maxDisplay = maxDisplayResult.rows[0].max;

    // ===== Режим 1: по конкретным ячейкам =====
    if (Array.isArray(cell_indices) && cell_indices.length > 0) {
      if (!container_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Для посева по ячейкам нужен container_id' });
      }

      const containerResult = await client.query(
        'SELECT * FROM containers WHERE id = $1 AND user_id = $2',
        [container_id, req.user.id]
      );
      const container = containerResult.rows[0];

      if (!container || !container.cols || !container.rows) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'У контейнера нет сетки ячеек' });
      }

      const totalCells = container.cols * container.rows;
      const requested = cell_indices.map((c) => Number(c));

      const invalid = requested.filter(
        (c) => !Number.isInteger(c) || c < 0 || c >= totalCells
      );
      if (invalid.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Указаны ячейки вне сетки кассеты' });
      }

      const unique = new Set(requested);
      if (unique.size !== requested.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Дубликаты ячеек в запросе' });
      }

      const occupiedResult = await client.query(`
        SELECT cell_index FROM plants
        WHERE container_id = $1 AND user_id = $2 AND cell_index IS NOT NULL
      `, [container_id, req.user.id]);

      const occupied = new Set(occupiedResult.rows.map((r) => r.cell_index));
      const conflicts = requested.filter((c) => occupied.has(c));

      if (conflicts.length > 0) {
        const list = conflicts.sort((a, b) => a - b).map((c) => `#${c + 1}`).join(', ');
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Ячейки ${list} уже заняты` });
      }

      const sortedCells = [...requested].sort((a, b) => a - b);

      const values = sortedCells
        .map((cellIndex, i) => {
          const num = i + 1;                   // номер внутри партии
          const displayNum = maxDisplay + i + 1; // сквозной номер юзера
          return `(${batch.id}, ${Number(container_id)}, ${cellIndex}, ${num}, 'sown', ${displayNum}, ${req.user.id})`;
        })
        .join(',');

      const plantsResult = await client.query(`
        INSERT INTO plants (batch_id, container_id, cell_index, number, status, display_number, user_id)
        VALUES ${values}
        RETURNING *
      `);
      createdPlants = plantsResult.rows;
    }

    // ===== Режим 2: по отдельным горшкам =====
    if (Array.isArray(container_ids) && container_ids.length > 0) {
      const plantsResult = await client.query(`
        INSERT INTO plants (batch_id, container_id, cell_index, number, status, display_number, user_id)
        SELECT $1, cid, NULL, ROW_NUMBER() OVER (ORDER BY cid), 'sown',
               $4 + ROW_NUMBER() OVER (ORDER BY cid),
               $3
        FROM unnest($2::int[]) AS cid
        RETURNING *
      `, [batch.id, container_ids, req.user.id, maxDisplay]);
      createdPlants = plantsResult.rows;
    }

    await client.query('COMMIT');
    res.status(201).json({ ...batch, plants: createdPlants });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания партии' });
  } finally {
    client.release();
  }
});

// POST /api/batches/:id/germinate
router.post('/:id/germinate', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { count } = req.body;

    if (!count || count < 1) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Поле count обязательно (>= 1)' });
    }

    const batchResult = await client.query(
      'SELECT * FROM batches WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (batchResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Партия не найдена' });
    }

    const batch = batchResult.rows[0];

    if (!batch.container_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'У партии не указан container_id — нельзя создать растения',
      });
    }

    // Сколько уже в партии (для number)
    const existingResult = await client.query(
      'SELECT COUNT(*)::int AS existing FROM plants WHERE batch_id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    const existingCount = existingResult.rows[0].existing;

    // Максимальный сквозной номер юзера
    const maxDisplayResult = await client.query(
      'SELECT COALESCE(MAX(display_number), 0)::int AS max FROM plants WHERE user_id = $1',
      [req.user.id]
    );
    const maxDisplay = maxDisplayResult.rows[0].max;

    const plants = [];
    for (let i = 0; i < count; i++) {
      const number = existingCount + i + 1;
      const displayNum = maxDisplay + i + 1;
      const result = await client.query(
        `INSERT INTO plants (batch_id, container_id, cell_index, number, status, display_number, user_id)
         VALUES ($1, $2, NULL, $3, 'growing', $4, $5)
         RETURNING *`,
        [id, batch.container_id, number, displayNum, req.user.id]
      );
      plants.push(result.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ batch_id: Number(id), created: plants.length, plants });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ошибка отметки всходов' });
  } finally {
    client.release();
  }
});

// PUT /api/batches/:id/mark-germinated
router.put('/:id/mark-germinated', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE plants
      SET status = 'growing', updated_at = NOW()
      WHERE batch_id = $1 AND user_id = $2 AND status = 'sown'
      RETURNING *
    `, [id, req.user.id]);

    res.json({ updated: result.rowCount, plants: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка отметки всходов' });
  }
});

// DELETE /api/batches/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM batches WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Партия не найдена' });
    }
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления партии' });
  }
});

module.exports = router;