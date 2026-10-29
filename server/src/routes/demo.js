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

async function createZone(client, userId, { name, type, widthCm, depthCm, bg, shelfCount }) {
  const { canvasWidth, canvasHeight, pxPerCm } = calcCanvas(type, widthCm, depthCm, shelfCount);
  const r = await client.query(`
    INSERT INTO zones (user_id, name, type, width_cm, depth_cm, px_per_cm,
                       background_color, grid_size, canvas_width, canvas_height,
                       shelf_count, is_demo)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 20, $8, $9, $10, true)
    RETURNING *
  `, [userId, name, type, widthCm, depthCm, pxPerCm, bg, canvasWidth, canvasHeight, shelfCount || null]);
  return r.rows[0];
}

async function createShelf(client, zoneId, { name, y, height, sortOrder }) {
  await client.query(`
    INSERT INTO zone_shelves (zone_id, name, y, height, color, sort_order)
    VALUES ($1, $2, $3, $4, '#f5f0e6', $5)
  `, [zoneId, name, y, height, sortOrder]);
}

async function createContainer(client, userId, { zoneId, name, type, x, y, width, height, cols, rows }) {
  const r = await client.query(`
    INSERT INTO containers (user_id, zone_id, name, type, x, y, width, height, cols, rows)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, [userId, zoneId, name, type, x, y, width, height, cols || null, rows || null]);
  return r.rows[0];
}

async function createBatch(client, userId, { containerId, species, variety, sowingDaysAgo, seedsCount }) {
  const r = await client.query(`
    INSERT INTO batches (user_id, species, variety, sowing_date, seeds_count, container_id, is_demo)
    VALUES ($1, $2, $3, CURRENT_DATE - ($4 * INTERVAL '1 day'), $5, $6, true)
    RETURNING *
  `, [userId, species, variety, sowingDaysAgo, seedsCount, containerId]);
  return r.rows[0];
}

async function createPlant(client, userId, { batchId, containerId, number, cellIndex, status }) {
  // Сквозной номер в рамках юзера
  const maxRes = await client.query(
    'SELECT COALESCE(MAX(display_number), 0)::int AS max FROM plants WHERE user_id = $1',
    [userId]
  );
  const displayNum = maxRes.rows[0].max + 1;

  const r = await client.query(`
    INSERT INTO plants (user_id, batch_id, container_id, cell_index, number, status, display_number)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [userId, batchId, containerId, cellIndex, number, status, displayNum]);
  return r.rows[0];
}

async function createEvent(client, userId, { plantId, type, daysAgo, fromContainerId, toContainerId, fromStatus, toStatus, notes }) {
  await client.query(`
    INSERT INTO plant_events 
      (user_id, plant_id, event_type, event_date, from_container_id, to_container_id, from_status, to_status, notes)
    VALUES ($1, $2, $3, CURRENT_DATE - ($4 * INTERVAL '1 day'), $5, $6, $7, $8, $9)
  `, [userId, plantId, type, daysAgo, fromContainerId || null, toContainerId || null, fromStatus || null, toStatus || null, notes || null]);
}

// POST /api/demo/seed
router.post('/seed', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const uid = req.user.id;

    const existing = await client.query(
      'SELECT id FROM zones WHERE user_id = $1 AND is_demo = true LIMIT 1',
      [uid]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Демо-данные уже загружены' });
    }

    // ===== Зона 1: Подоконник =====
    const surfaceZone = await createZone(client, uid, {
      name: 'Подоконник на кухне',
      type: 'surface',
      widthCm: 120,
      depthCm: 40,
      bg: '#faf6ef',
    });

    // Кассета петуний (с сеткой 5×2)
    const trayPetunia = await createContainer(client, uid, {
      zoneId: surfaceZone.id, name: 'Кассета петуний', type: 'tray',
      x: 30, y: 30, width: 300, height: 200, cols: 5, rows: 2,
    });
    const batchPetunia = await createBatch(client, uid, {
      containerId: trayPetunia.id, species: 'Петуния', variety: 'Тайдал Вейв',
      sowingDaysAgo: 45, seedsCount: 10,
    });
    const petuniaStatuses = ['flowering','flowering','flowering','flowering','flowering','flowering','growing','growing','growing','growing'];
    for (let i = 0; i < 10; i++) {
      await createPlant(client, uid, {
        batchId: batchPetunia.id, containerId: trayPetunia.id,
        number: i + 1, cellIndex: i, status: petuniaStatuses[i],
      });
    }

    // Горшок с черри
    const potCherry = await createContainer(client, uid, {
      zoneId: surfaceZone.id, name: 'Горшок с черри', type: 'pot',
      x: 400, y: 30, width: 150, height: 150,
    });
    const batchCherry = await createBatch(client, uid, {
      containerId: potCherry.id, species: 'Томат', variety: 'Черри',
      sowingDaysAgo: 30, seedsCount: 5,
    });
    for (let i = 0; i < 3; i++) {
      await createPlant(client, uid, {
        batchId: batchCherry.id, containerId: potCherry.id,
        number: i + 1, cellIndex: null, status: 'growing',
      });
    }

    // ===== Зона 2: Стеллаж (4 полки) =====
    const shelfZone = await createZone(client, uid, {
      name: 'Стеллаж у окна',
      type: 'shelf',
      widthCm: 80,
      depthCm: 30,
      bg: '#f5f0e6',
      shelfCount: 4,
    });

    const shelfNames = ['Полка 4', 'Полка 3', 'Полка 2', 'Полка 1'];
    for (let i = 0; i < 4; i++) {
      await createShelf(client, shelfZone.id, {
        name: shelfNames[i], y: i * 300, height: 300, sortOrder: i,
      });
    }

    // Лоток с томатами (БЕЗ сетки — россыпь) на верхней полке
    const trayTomato = await createContainer(client, uid, {
      zoneId: shelfZone.id,
      name: 'Лоток с томатами',
      type: 'tray',
      x: 380, y: 20,
      width: 300, height: 200,
      // cols / rows не передаём → россыпь без ячеек
    });
    const batchTomatoShelf = await createBatch(client, uid, {
      containerId: trayTomato.id,
      species: 'Томат',
      variety: 'Черри',
      sowingDaysAgo: 25,
      seedsCount: 10,
    });

    // Создаём 10 растений: 6 взошли, 4 ещё sown (не взошли)
    for (let i = 0; i < 10; i++) {
      const isGerminated = i < 6;
      await createPlant(client, uid, {
        batchId: batchTomatoShelf.id,
        containerId: trayTomato.id,
        number: i + 1,
        cellIndex: null,
        status: isGerminated ? (i < 4 ? 'growing' : 'flowering') : 'sown',
      });
    }

    // Кассета базилика (сетка 3×2)
    const trayBasil = await createContainer(client, uid, {
      zoneId: shelfZone.id, name: 'Кассета базилика', type: 'tray',
      x: 30, y: 320, width: 300, height: 200, cols: 3, rows: 2,
    });
    const batchBasil = await createBatch(client, uid, {
      containerId: trayBasil.id, species: 'Базилик', variety: 'Генуэзский',
      sowingDaysAgo: 20, seedsCount: 6,
    });
    for (let i = 0; i < 6; i++) {
      await createPlant(client, uid, {
        batchId: batchBasil.id, containerId: trayBasil.id,
        number: i + 1, cellIndex: i, status: 'growing',
      });
    }

    // Горшок с перцем
    const potPepper = await createContainer(client, uid, {
      zoneId: shelfZone.id, name: 'Горшок с перцем', type: 'pot',
      x: 30, y: 700, width: 100, height: 100,
    });
    const batchPepper = await createBatch(client, uid, {
      containerId: potPepper.id, species: 'Перец', variety: 'Калифорнийское чудо',
      sowingDaysAgo: 50, seedsCount: 1,
    });
    const pepperPlant = await createPlant(client, uid, {
      batchId: batchPepper.id, containerId: potPepper.id,
      number: 1, cellIndex: null, status: 'flowering',
    });
    await createEvent(client, uid, {
      plantId: pepperPlant.id, type: 'status_change', daysAgo: 5,
      fromStatus: 'growing', toStatus: 'flowering',
    });
    await createEvent(client, uid, {
      plantId: pepperPlant.id, type: 'note', daysAgo: 5,
      notes: 'Появились первые бутоны',
    });

    // Горшок с огурцом
    const potCucumber = await createContainer(client, uid, {
      zoneId: shelfZone.id, name: 'Горшок с огурцом', type: 'pot',
      x: 30, y: 1000, width: 120, height: 120,
    });
    const batchCucumber = await createBatch(client, uid, {
      containerId: potCucumber.id, species: 'Огурец', variety: 'Зозуля',
      sowingDaysAgo: 25, seedsCount: 2,
    });
    for (let i = 0; i < 2; i++) {
      await createPlant(client, uid, {
        batchId: batchCucumber.id, containerId: potCucumber.id,
        number: i + 1, cellIndex: null, status: 'growing',
      });
    }

    // ===== Зона 3: Огород (только морковь) =====
    const gardenZone = await createZone(client, uid, {
      name: 'Огород',
      type: 'garden',
      widthCm: 600,
      depthCm: 400,
      bg: '#e8f0e0',
    });

    const bedCarrot = await createContainer(client, uid, {
      zoneId: gardenZone.id, name: 'Грядка моркови', type: 'bed',
      x: 50, y: 50, width: 400, height: 200,
    });
    const batchCarrot = await createBatch(client, uid, {
      containerId: bedCarrot.id, species: 'Морковь', variety: 'Нантская',
      sowingDaysAgo: 40, seedsCount: 20,
    });
    // Взошло 15 из 20
    for (let i = 0; i < 15; i++) {
      await createPlant(client, uid, {
        batchId: batchCarrot.id, containerId: bedCarrot.id,
        number: i + 1, cellIndex: null, status: 'growing',
      });
    }

    await client.query('COMMIT');

    res.json({ success: true, zones: 3, containers: 7, batches: 7 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Demo seed error:', err);
    res.status(500).json({ error: 'Ошибка создания демо-данных', details: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/demo — только демо текущего пользователя
router.delete('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const uid = req.user.id;

    await client.query(
      'DELETE FROM batches WHERE user_id = $1 AND is_demo = true',
      [uid]
    );
    await client.query(
      'DELETE FROM zones WHERE user_id = $1 AND is_demo = true',
      [uid]
    );

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления демо-данных' });
  } finally {
    client.release();
  }
});

module.exports = router;