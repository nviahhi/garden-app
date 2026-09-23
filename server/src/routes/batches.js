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
      GROUP BY b.id, c.name, c.type
      ORDER BY b.sowing_date DESC, b.id DESC
    `);
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
      SELECT 
        b.*,
        c.name AS container_name,
        c.type AS container_type
      FROM batches b
      LEFT JOIN containers c ON c.id = b.container_id
      WHERE b.id = $1
    `, [id]);

    if (batchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Партия не найдена' });
    }

    const plantsResult = await pool.query(`
      SELECT p.*, c.name AS container_name, c.type AS container_type
      FROM plants p
      LEFT JOIN containers c ON c.id = p.container_id
      WHERE p.batch_id = $1
      ORDER BY p.number
    `, [id]);

    res.json({
      ...batchResult.rows[0],
      plants: plantsResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения партии' });
  }
});

// POST /api/batches
// Body: { species, variety, sowing_date, seeds_count,
//         container_id?, cell_indices?,      // один контейнер / ячейки
//         container_ids?,                    // группа горшков
//         notes? }
router.post('/', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      species,
      variety,
      sowing_date,
      seeds_count,
      container_id,
      cell_indices,
      container_ids,
      notes,
    } = req.body;

    if (!species || !sowing_date || !seeds_count) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Обязательные поля: species, sowing_date, seeds_count',
      });
    }

    // Определяем основной container_id для партии
    let batchContainerId = container_id || null;
    if (Array.isArray(container_ids) && container_ids.length === 1) {
      batchContainerId = container_ids[0];
    }
    // для группы горшков container_id = null

    const batchResult = await client.query(
      `INSERT INTO batches (species, variety, sowing_date, seeds_count, container_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [species, variety || null, sowing_date, seeds_count, batchContainerId, notes || null]
    );

    const batch = batchResult.rows[0];
    let createdPlants = [];

    // === Режим 1: по ячейкам кассеты ===
    if (Array.isArray(cell_indices) && cell_indices.length > 0) {
      if (!container_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Для посева по ячейкам нужен container_id',
        });
      }

      const values = cell_indices
        .map((cellIndex, i) => {
          const num = i + 1;
          const safeCell = Number(cellIndex);
          const safeContainer = Number(container_id);
          return `(${batch.id}, ${safeContainer}, ${safeCell}, ${num}, 'sown')`;
        })
        .join(',');

      const plantsResult = await client.query(`
        INSERT INTO plants (batch_id, container_id, cell_index, number, status)
        VALUES ${values}
        RETURNING *
      `);
      createdPlants = plantsResult.rows;
    }

    // === Режим 2: по отдельным горшкам (по 1 растению в горшок) ===
    if (Array.isArray(container_ids) && container_ids.length > 0) {
      const plantsResult = await client.query(`
        INSERT INTO plants (batch_id, container_id, cell_index, number, status)
        SELECT $1, cid, NULL, ROW_NUMBER() OVER (ORDER BY cid), 'sown'
        FROM unnest($2::int[]) AS cid
        RETURNING *
      `, [batch.id, container_ids]);
      createdPlants = plantsResult.rows;
    }

    await client.query('COMMIT');

    res.status(201).json({
      ...batch,
      plants: createdPlants,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания партии' });
  } finally {
    client.release();
  }
});

// POST /api/batches/:id/germinate
// Для россыпи — создаёт N растений сразу со статусом 'germinated'
// Body: { count }
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
      'SELECT * FROM batches WHERE id = $1',
      [id]
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

    const existingResult = await client.query(
      'SELECT COUNT(*)::int AS existing FROM plants WHERE batch_id = $1',
      [id]
    );
    const existingCount = existingResult.rows[0].existing;

    const plants = [];
    for (let i = 0; i < count; i++) {
      const number = existingCount + i + 1;
      const result = await client.query(
        `INSERT INTO plants (batch_id, container_id, cell_index, number, status)
         VALUES ($1, $2, NULL, $3, 'germinated')
         RETURNING *`,
        [id, batch.container_id, number]
      );
      plants.push(result.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      batch_id: Number(id),
      created: plants.length,
      plants,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ошибка отметки всходов' });
  } finally {
    client.release();
  }
});

// PUT /api/batches/:id/mark-germinated
// Переводит все растения партии со статусом 'sown' в 'germinated'
router.put('/:id/mark-germinated', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE plants
      SET status = 'germinated', updated_at = NOW()
      WHERE batch_id = $1 AND status = 'sown'
      RETURNING *
    `, [id]);

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
      'DELETE FROM batches WHERE id = $1 RETURNING *',
      [id]
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