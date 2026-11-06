/**
 * Сбор досье сада из БД для подмешивания в промпт ИИ.
 *
 * Возвращает компактный текст, который модель использует как «контекст».
 * Все числа — уже посчитанные SQL-агрегаты. Модель только интерпретирует.
 */

const pool = require('../db');

/**
 * Собрать досье сада для пользователя.
 *
 * @param {number} userId
 * @param {string|null} seasonStart — дата начала сезона (NULL = всё время)
 * @returns {Promise<string>} компактный текст-контекст
 */
async function buildContext(userId, seasonStart) {
  // Всегда передаём оба параметра — Postgres знает тип $2::timestamptz.
  // seasonStart = NULL означает «без фильтра по сезону», поэтому заглушка
  // должна быть '-infinity' (created_at >= '-infinity' — всегда true).
  // 'infinity' здесь инвертировал бы фильтр и давал бы пустое досье.
  const params = [userId, seasonStart];
  const since = `COALESCE($2::timestamptz, '-infinity')`;

  // ===== 1. Общие счётчики =====
  const totals = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM plants WHERE user_id = $1
        AND created_at >= ${since}) AS plants,
      (SELECT COUNT(*)::int FROM zones WHERE user_id = $1
        AND created_at >= ${since}) AS zones,
      (SELECT COUNT(*)::int FROM containers WHERE user_id = $1
        AND created_at >= ${since}) AS containers,
      (SELECT COUNT(*)::int FROM batches WHERE user_id = $1
        AND created_at >= ${since}) AS batches,
      (SELECT COUNT(*)::int FROM plants
         WHERE user_id = $1 AND created_at >= ${since} AND status = 'sown') AS sown,
      (SELECT COUNT(*)::int FROM plants
         WHERE user_id = $1 AND created_at >= ${since} AND status = 'growing') AS growing,
      (SELECT COUNT(*)::int FROM plants
         WHERE user_id = $1 AND created_at >= ${since} AND status = 'flowering') AS flowering,
      (SELECT COUNT(*)::int FROM plants
         WHERE user_id = $1 AND created_at >= ${since} AND status = 'fruiting') AS fruiting,
      (SELECT COUNT(*)::int FROM plants
         WHERE user_id = $1 AND created_at >= ${since} AND status = 'done') AS done
  `, params);

  const t = totals.rows[0];

  // ===== 2. Всхожесть по сортам =====
  const bySpecies = await pool.query(`
    WITH batch_stats AS (
      SELECT species, COALESCE(variety, '') AS variety,
             SUM(seeds_count)::int AS seeds, COUNT(*)::int AS batches
      FROM batches WHERE user_id = $1 AND created_at >= ${since}
      GROUP BY species, variety HAVING SUM(seeds_count) > 0
    ),
    plant_stats AS (
      SELECT b.species, COALESCE(b.variety, '') AS variety,
             COUNT(p.id)::int AS plants,
             COUNT(p.id) FILTER (WHERE p.status != 'sown')::int AS germinated
      FROM plants p
      JOIN batches b ON b.id = p.batch_id
      WHERE p.user_id = $1 AND p.created_at >= ${since}
      GROUP BY b.species, b.variety
    )
    SELECT bs.species, bs.variety, bs.seeds, bs.batches,
           COALESCE(ps.plants, 0) AS plants,
           COALESCE(ps.germinated, 0) AS germinated
    FROM batch_stats bs
    LEFT JOIN plant_stats ps ON ps.species = bs.species AND ps.variety = bs.variety
    ORDER BY (CASE WHEN ps.germinated = 0 AND ps.plants = 0 THEN 1 ELSE 0 END),
             (COALESCE(ps.germinated, 0)::float / NULLIF(bs.seeds, 0)) DESC
  `, params);

  // ===== 3. Долгий sown (не взошли) =====
  const longSown = await pool.query(`
    SELECT b.species, b.variety, p.number,
           p.status,
           (CURRENT_DATE - b.sowing_date)::int AS days_sown
    FROM plants p
    JOIN batches b ON b.id = p.batch_id
    WHERE p.user_id = $1 AND p.status = 'sown'
      AND p.created_at >= ${since}
    ORDER BY days_sown DESC
  `, params);

  // ===== 4. Растения в цветении в маленьких горшках =====
  const floweringInSmallPot = await pool.query(`
    SELECT p.number, p.status, b.species, b.variety,
           c.name AS container_name, c.type AS container_type,
           c.width, c.height, c.cols, c.rows,
           z.px_per_cm
    FROM plants p
    JOIN batches b ON b.id = p.batch_id
    JOIN containers c ON c.id = p.container_id
    JOIN zones z ON z.id = c.zone_id
    WHERE p.user_id = $1 AND p.status = 'flowering'
      AND p.created_at >= ${since}
      AND c.type = 'pot'
      AND c.width < 200
    ORDER BY p.number
  `, params);

  // ===== 5. События =====
  const eventsCount = await pool.query(`
    SELECT COUNT(*)::int AS total
    FROM plant_events e
    JOIN plants p ON p.id = e.plant_id
    WHERE p.user_id = $1 AND p.created_at >= ${since}
  `, params);

  const lastWater = await pool.query(`
    SELECT MAX(e.event_date) AS last_date
    FROM plant_events e
    JOIN plants p ON p.id = e.plant_id
    WHERE p.user_id = $1 AND e.event_type = 'water'
      AND p.created_at >= ${since}
  `, params);

  // Растения, которые ни разу не поливали (всё, что вышло и живёт)
  const noWater = await pool.query(`
    SELECT COUNT(*)::int AS total
    FROM plants p
    WHERE p.user_id = $1 AND p.created_at >= ${since}
      AND p.status NOT IN ('sown', 'done')
      AND NOT EXISTS (
        SELECT 1 FROM plant_events e
        WHERE e.plant_id = p.id AND e.event_type = 'water'
      )
  `, params);

  // ===== 6. Заполненность контейнеров =====
  const containerUse = await pool.query(`
    SELECT c.name, c.type, c.width, c.height, c.cols, c.rows, z.px_per_cm,
           COUNT(p.id) FILTER (WHERE p.status != 'done')::int AS plants_in
    FROM containers c
    JOIN zones z ON z.id = c.zone_id
    LEFT JOIN plants p ON p.container_id = c.id AND p.user_id = $1
      AND p.created_at >= ${since}
    WHERE c.user_id = $1 AND c.created_at >= ${since}
    GROUP BY c.id, c.name, c.type, c.width, c.height, c.cols, c.rows, z.px_per_cm
    ORDER BY plants_in ASC, c.name
  `, params);

  // ===== 7. Возраст партий =====
  const batchAge = await pool.query(`
    SELECT species, COALESCE(variety, '') AS variety,
           to_char(sowing_date, 'YYYY-MM-DD') AS sowing_date,
           seeds_count,
           (CURRENT_DATE - sowing_date)::int AS days_ago
    FROM batches
    WHERE user_id = $1 AND created_at >= ${since}
    ORDER BY sowing_date ASC
  `, params);

  // ===== Формируем текст =====
  const lines = [];

  // Склонение: plural(3, ['семя','семени','семян']) → 'семени'
  const plural = (n, forms) => {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last > 1 && last < 5) return forms[1];
    if (last === 1) return forms[0];
    return forms[2];
  };

  const today = new Date().toISOString().slice(0, 10);
  lines.push(`=== Досье сада ===`);
  lines.push(`Сегодня: ${today}`);
  lines.push(
    seasonStart
      ? `Сезон начат: ${seasonStart} (показаны только данные с этой даты)`
      : `Сезон не сбрасывался — показаны все данные за всё время`
  );
  lines.push(
    `Зоны: ${t.zones}, Контейнеры: ${t.containers}, ` +
    `Партии: ${t.batches}, Растений: ${t.plants}`
  );
  lines.push(
    `Статусы: sown=${t.sown}, growing=${t.growing}, ` +
    `flowering=${t.flowering}, fruiting=${t.fruiting}, done=${t.done}`
  );
  lines.push(``);

  // Всхожесть
  if (bySpecies.rows.length > 0) {
    lines.push(`Всхожесть по сортам:`);
    for (const r of bySpecies.rows) {
      const rate = r.seeds > 0
        ? Math.round((r.germinated / r.seeds) * 100)
        : null;
      const rateStr = rate != null ? `${rate}%` : '—';
      const label = r.variety ? `${r.species} «${r.variety}»` : r.species;
      lines.push(
        `  ${label}: ${r.seeds} ${plural(r.seeds, ['семя', 'семени', 'семян'])}, ` +
        `${r.germinated}/${r.plants} взошло (${rateStr})`
      );
    }
    lines.push(``);
  }

  // Долгий sown
  if (longSown.rows.length > 0) {
    lines.push(`⚠ Растения без всходов (статус sown):`);
    for (const r of longSown.rows) {
      lines.push(
        `  #${r.number} ${r.species}${r.variety ? ` «${r.variety}»` : ''} — ${r.days_sown} дн. с посева`
      );
    }
    lines.push(``);
  }

  // Цветущие в маленьких горшках
  if (floweringInSmallPot.rows.length > 0) {
    lines.push(`⚠ Цветут в тесной таре:`);
    for (const r of floweringInSmallPot.rows) {
      lines.push(
        `  #${r.number} ${r.species}${r.variety ? ` «${r.variety}»` : ''} в «${r.container_name}» ` +
        `(${Math.round(r.width / r.px_per_cm)}×${Math.round(r.height / r.px_per_cm)} см)`
      );
    }
    lines.push(``);
  }

  // Партии по датам
  if (batchAge.rows.length > 0) {
    lines.push(`Партии (возраст от даты посева):`);
    for (const r of batchAge.rows) {
      lines.push(
        `  ${r.species}${r.variety ? ` «${r.variety}»` : ''}: посев ${String(r.sowing_date).slice(0, 10)}, ` +
        `${r.seeds_count} сем., возраст ${r.days_ago} дн.`
      );
    }
    lines.push(``);
  }

  // Контейнеры: свободные и занятые
  if (containerUse.rows.length > 0) {
    lines.push(`Контейнеры (сколько растений живёт):`);
    for (const r of containerUse.rows) {
      const cm = `${Math.round(r.width / r.px_per_cm)}×${Math.round(r.height / r.px_per_cm)} см`;
      const cap = r.type === 'tray' ? r.cols * r.rows : 1;
      const free = r.type === 'tray' ? Math.max(0, cap - r.plants_in) : null;
      const freeStr = free != null ? `, свободно ячеек: ${free}` : '';
      lines.push(
        `  «${r.name}» (${r.type}, ${cm}): ${r.plants_in} раст.${freeStr}`
      );
    }
    const empty = containerUse.rows.filter((r) => r.plants_in === 0);
    if (empty.length > 0) {
      lines.push(`  → Свободная тара для пересадки: ${empty.map((c) => `«${c.name}»`).join(', ')}`);
    }
    lines.push(``);
  }

  // Уход / события
  lines.push(`Уход за сезон: событий ${eventsCount.rows[0].total}`);
  if (lastWater.rows[0].last_date) {
    const days = Math.floor(
      (Date.now() - new Date(lastWater.rows[0].last_date).getTime()) / 86400000
    );
    lines.push(`Последний зафиксированный полив: ${days} дн. назад`);
  } else {
    lines.push(`Поливы не фиксировались ни разу`);
  }
  if (noWater.rows[0].total > 0) {
    lines.push(`⚠ Растений без единой записи о поливе: ${noWater.rows[0].total}`);
  }
  if (eventsCount.rows[0].total === 0) {
    lines.push(`⚠ История ухода пуста — нельзя судить о поливах и пересадках`);
  }
  lines.push(``);

  return lines.join('\n');
}

module.exports = { buildContext };
