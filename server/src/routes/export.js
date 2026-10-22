const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/export/plants?zone_id=1  ИЛИ  ?batch_id=2
router.get('/plants', async (req, res) => {
  try {
    const { zone_id, batch_id } = req.query;

    let where = '';
    const params = [];

    if (batch_id) {
      params.push(batch_id);
      where = `WHERE p.batch_id = $${params.length}`;
    } else if (zone_id) {
      params.push(zone_id);
      where = `WHERE c.zone_id = $${params.length}`;
    }

    const result = await pool.query(`
      SELECT 
        p.*,
        b.species, b.variety, b.sowing_date,
        c.name AS container_name, c.type AS container_type,
        c.zone_id AS container_zone_id
      FROM plants p
      JOIN batches b ON b.id = p.batch_id
      LEFT JOIN containers c ON c.id = p.container_id
      ${where}
      ORDER BY p.display_number
    `, params);

    const plantIds = result.rows.map((p) => p.id);
    const eventsByPlant = {};

    if (plantIds.length > 0) {
      const eventsResult = await pool.query(`
        SELECT e.*,
               fc.name AS from_container_name,
               tc.name AS to_container_name
        FROM plant_events e
        LEFT JOIN containers fc ON fc.id = e.from_container_id
        LEFT JOIN containers tc ON tc.id = e.to_container_id
        WHERE e.plant_id = ANY($1::int[])
        ORDER BY e.event_date ASC, e.id ASC
      `, [plantIds]);

      for (const ev of eventsResult.rows) {
        if (!eventsByPlant[ev.plant_id]) eventsByPlant[ev.plant_id] = [];
        eventsByPlant[ev.plant_id].push(ev);
      }
    }

    res.json(
      result.rows.map((p) => ({
        ...p,
        events: eventsByPlant[p.id] ?? [],
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка экспорта растений' });
  }
});

module.exports = router;