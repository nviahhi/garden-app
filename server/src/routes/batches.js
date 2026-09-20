const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/batches — все партии с количеством растений и именем контейнера
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

// GET /api/batches/:id — одна партия + список растений
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

// POST /api/batches — создать партию
// Body: { species, variety, sowing_date, seeds_count, container_id, cell_indices?, notes? }
// Если передан cell_indices — сразу создаём растения для этих ячеек
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
      notes,
    } = req.body;

    if (!species || !sowing_date || !seeds_count) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Обязательные поля: species, sowing_date, seeds_count',
      });
    }

    // Создаём партию
    const batchResult = await client.query(
      `INSERT INTO batches (species, variety, sowing_date, seeds_count, container_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        species,
        variety || null,
        sowing_date,
        seeds_count,
        container_id || null,
        notes || null,
      ]
    );

    const batch = batchResult.rows[0];

    // Если переданы ячейки — создаём растения сразу
    let createdPlants = [];
    if (Array.isArray(cell_indices) && cell_indices.length > 0) {
      if (!container_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Для посева по ячейкам нужен container_id',
        });
      }

      // Формируем VALUES ($1,$2,$3,$4,$5), ($1,$2,$6,$7,$5), ...
      const values = cell_indices
        .map((cellIndex, i) => {
          const num = i + 1;
          // Проверяем, что числа (защита от инъекций)
          const safeCell = Number(cellIndex);
          const safeContainer = Number(container_id);
          return `(${batch.id}, ${safeContainer}, ${safeCell}, ${num}, 'seedling')`;
        })
        .join(',');

      const plantsResult = await client.query(`
        INSERT INTO plants (batch_id, container_id, cell_index, number, status)
        VALUES ${values}
        RETURNING *
      `);
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

// POST /api/batches/:id/germinate — отметить всходы
// Body: { count } — сколько растений взошло
// Создаёт N растений в контейнере партии (россыпью, cell_index = NULL)
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

    // Получаем партию
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

    // Узнаём, сколько растений уже создано (чтобы не дублировать номера)
    const existingResult = await client.query(
      'SELECT COUNT(*)::int AS existing FROM plants WHERE batch_id = $1',
      [id]
    );
    const existingCount = existingResult.rows[0].existing;

    // Создаём N растений
    const plants = [];
    for (let i = 0; i < count; i++) {
      const number = existingCount + i + 1;
      const result = await client.query(
        `INSERT INTO plants (batch_id, container_id, cell_index, number, status)
         VALUES ($1, $2, NULL, $3, 'seedling')
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

// DELETE /api/batches/:id — удалить партию (каскадно удалит растения)
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