const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/stats
router.get('/', async (req, res) => {
  try {
    const uid = req.user.id;

    // ===== 1. Общие счётчики =====
    const totalsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM plants WHERE user_id = $1)      AS plants,
        (SELECT COUNT(*)::int FROM batches WHERE user_id = $1)     AS batches,
        (SELECT COUNT(*)::int FROM containers WHERE user_id = $1)  AS containers,
        (SELECT COUNT(*)::int FROM zones WHERE user_id = $1)       AS zones,
        (SELECT COALESCE(SUM(seeds_count), 0)::int FROM batches WHERE user_id = $1) AS total_seeds,
        (SELECT COUNT(*)::int FROM plants
           WHERE user_id = $1 AND container_id IS NULL)            AS orphans,
        (SELECT COUNT(*)::int FROM plants
           WHERE user_id = $1 AND status != 'sown')                AS germinated,
        (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - b.sowing_date)) / 86400))::int
           FROM plants p JOIN batches b ON b.id = p.batch_id
           WHERE p.user_id = $1 AND p.status IN ('growing', 'flowering', 'fruiting')
        ) AS avg_age_days
    `, [uid]);

    // ===== 2. По статусам =====
    const byStatusResult = await pool.query(`
      SELECT status, COUNT(*)::int AS count
      FROM plants WHERE user_id = $1
      GROUP BY status
    `, [uid]);

    const byStatus = { sown: 0, growing: 0, flowering: 0, fruiting: 0, done: 0 };
    for (const row of byStatusResult.rows) {
      if (row.status in byStatus) byStatus[row.status] = row.count;
    }

    // ===== 3. Всхожесть по сортам (БЕЗ LEFT JOIN-бага) =====
    // Считаем семена и растения в двух независимых агрегатах,
    // потом соединяем их по (species, variety).
    const bySpeciesResult = await pool.query(`
      WITH batch_stats AS (
        SELECT
          species,
          COALESCE(variety, '') AS variety,
          SUM(seeds_count)::int AS seeds,
          COUNT(*)::int AS batches
        FROM batches
        WHERE user_id = $1
        GROUP BY species, variety
        HAVING SUM(seeds_count) > 0
      ),
      plant_stats AS (
        SELECT
          b.species,
          COALESCE(b.variety, '') AS variety,
          COUNT(p.id)::int AS plants,
          COUNT(p.id) FILTER (WHERE p.status != 'sown')::int AS germinated
        FROM plants p
        JOIN batches b ON b.id = p.batch_id
        WHERE p.user_id = $1
        GROUP BY b.species, b.variety
      )
      SELECT
        bs.species,
        bs.variety,
        bs.seeds,
        bs.batches,
        COALESCE(ps.plants, 0)::int AS plants,
        COALESCE(ps.germinated, 0)::int AS germinated
      FROM batch_stats bs
      LEFT JOIN plant_stats ps
        ON ps.species = bs.species AND ps.variety = bs.variety
    `, [uid]);

    const bySpecies = bySpeciesResult.rows
      .map((r) => ({
        species: r.species,
        variety: r.variety,
        seeds: r.seeds,
        batches: r.batches,
        plants: r.plants,
        germinated: r.germinated,
        rate: r.seeds > 0 ? Math.round((r.germinated / r.seeds) * 100) : 0,
      }))
      .sort((a, b) => b.rate - a.rate || b.germinated - a.germinated);

    // ===== 4. По зонам =====
    const byZoneResult = await pool.query(`
      SELECT
        z.id, z.name, z.type,
        COUNT(DISTINCT c.id)::int AS containers,
        COUNT(p.id)::int AS plants
      FROM zones z
      LEFT JOIN containers c ON c.zone_id = z.id
      LEFT JOIN plants p ON p.container_id = c.id
      WHERE z.user_id = $1
      GROUP BY z.id
      ORDER BY plants DESC, z.name ASC
    `, [uid]);

    // ===== 5. Топ контейнеров =====
    const topContainersResult = await pool.query(`
      SELECT
        c.id, c.name, c.type,
        z.name AS zone_name,
        COUNT(p.id)::int AS plants
      FROM containers c
      LEFT JOIN plants p ON p.container_id = c.id
      LEFT JOIN zones z ON z.id = c.zone_id
      WHERE c.user_id = $1
      GROUP BY c.id, z.name
      HAVING COUNT(p.id) > 0
      ORDER BY plants DESC
      LIMIT 5
    `, [uid]);

    // ===== 6. Сорт × зона × контейнер × статус =====
    const bySpeciesLocationRaw = await pool.query(`
      SELECT
        b.species,
        COALESCE(b.variety, '') AS variety,
        z.id AS zone_id, z.name AS zone_name,
        c.id AS container_id, c.name AS container_name,
        p.status,
        COUNT(p.id)::int AS count
      FROM plants p
      JOIN batches b ON b.id = p.batch_id
      LEFT JOIN containers c ON c.id = p.container_id
      LEFT JOIN zones z ON z.id = c.zone_id
      WHERE p.user_id = $1
      GROUP BY b.species, b.variety, z.id, z.name, c.id, c.name, p.status
      ORDER BY b.species ASC, b.variety ASC, z.name ASC NULLS LAST, c.name ASC NULLS LAST, p.status
    `, [uid]);

    const bySpeciesLocationMap = new Map();
    for (const row of bySpeciesLocationRaw.rows) {
      const key = `${row.species}__${row.variety}`;
      if (!bySpeciesLocationMap.has(key)) {
        bySpeciesLocationMap.set(key, {
          species: row.species,
          variety: row.variety,
          total: 0,
          locations: new Map(),
        });
      }
      const group = bySpeciesLocationMap.get(key);
      group.total += row.count;

      const locKey = `${row.zone_id ?? 'null'}__${row.container_id ?? 'null'}`;
      if (!group.locations.has(locKey)) {
        group.locations.set(locKey, {
          zone_id: row.zone_id,
          zone_name: row.zone_name,
          container_id: row.container_id,
          container_name: row.container_name,
          status_counts: {},
          total: 0,
        });
      }
      const loc = group.locations.get(locKey);
      loc.status_counts[row.status] = (loc.status_counts[row.status] ?? 0) + row.count;
      loc.total += row.count;
    }

    const bySpeciesLocation = Array.from(bySpeciesLocationMap.values())
      .map((g) => ({
        species: g.species,
        variety: g.variety,
        total: g.total,
        locations: Array.from(g.locations.values()),
      }))
      .sort((a, b) => b.total - a.total || a.species.localeCompare(b.species));

    // ===== Ответ =====
    const totals = totalsResult.rows[0];

    res.json({
      totals: {
        ...totals,
        byStatus,
      },
      bySpecies,
      bySpeciesLocation,
      byZone: byZoneResult.rows,
      topContainers: topContainersResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

module.exports = router;