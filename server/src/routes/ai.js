/**
 * Роут /api/ai — анализ и чат с ИИ-ассистентом.
 *
 * Секретный API-ключ Яндекса живёт в server/.env и никогда не уходит на клиент.
 * История разбита по user_id, лимит 5 запросов/час для всех (включая гостей).
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { complete, YandexGptError } = require('../lib/yandexGpt');
const { buildContext } = require('../lib/gardenContext');
const { REFERENCE } = require('../lib/plantReference');

const RATE_LIMIT = 5; // запросов в час для всех пользователей

/** Получить season_start пользователя (NULL = всё время). */
async function getUserSeasonStart(userId) {
  const r = await pool.query(
    "SELECT to_char(season_start, 'YYYY-MM-DD') AS season_start FROM users WHERE id = $1",
    [userId]
  );
  return r.rows[0]?.season_start ?? null;
}

const SYSTEM_PROMPT = `Ты — агроном-консультант по рассаде и комнатному садоводству.

Правила:
- Отвечай по-русски, короткими абзацами и списками.
- Опирайся ТОЛЬКО на числа из «Досье сада» и справочник норм ниже. Ничего не выдумывай.
- Сравнивай фактический возраст растений (поле «возраст N дн.» / «N дн. с посева»)
  с нормой всхожести из справочника. Превышение нормы = проблема, меньше нормы = норма.
- Называй растения конкретно: номер (#7) и сорт («Томат Черри»), а не «одно из растений».
- Учитывай объём тары: для томата/перца/огурца минимум 3–5 л, для петунии 0.5–1 л.
- Не рекомендую пересаживать виды, которые плохо переносят пересадку (перец, огурец, морковь) —
  только перевалку с комом земли.
- Не ставь диагнозы болезням. Если признаки неясны — предложи осмотреть и повторить.
- Если данных для вывода нет — так и напиши: «данных нет».

Справочник норм по культурам:
${formatReference(REFERENCE)}

Если вопрос не про рассаду, растения или уход — отвечай одной фразой:
«Я помогаю только с рассадой и комнатным садоводством.»`;

function formatReference(ref) {
  const lines = [];
  for (const [key, norm] of Object.entries(ref)) {
    lines.push(
      `- ${norm.name}: всходы ${norm.daysToGerminationMin}-${norm.daysToGerminationMax} дн., ` +
      `горшок ${norm.minPotLiters} л, пересадка ${norm.transplantable}. ${norm.notes}`
    );
  }
  return lines.join('\n');
}

/**
 * Подсчёт количества запросов за последний час.
 * Считаем только ассистентские сообщения — по одному на запрос.
 * Возвращает количество использованных запросов и сколько осталось ждать.
 */
async function rateStatus(userId) {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS used,
            EXTRACT(EPOCH FROM (MIN(created_at) + INTERVAL '1 hour' - NOW()))::int AS wait_sec
     FROM ai_messages
     WHERE user_id = $1 AND role = 'assistant'
       AND created_at > NOW() - INTERVAL '1 hour'`,
    [userId]
  );
  return { used: r.rows[0].used, waitSec: Math.max(0, r.rows[0].wait_sec ?? 0) };
}

function rateLimitMessage(used, waitSec) {
  const min = Math.ceil(waitSec / 60);
  return `Лимит ${RATE_LIMIT} запросов в час исчерпан (${used} использовано). Новый запрос через ${min} мин.`;
}

/**
 * Записать сообщение в историю.
 *
 * @param {number} userId
 * @param {string} role — 'user' или 'assistant'
 * @param {string} content
 * @param {string} kind — 'analyze' или 'ask'
 */
async function saveMessage(userId, role, content, kind) {
  await pool.query(
    `INSERT INTO ai_messages (user_id, role, content, kind) VALUES ($1, $2, $3, $4)`,
    [userId, role, content, kind]
  );
}

// ===== GET /api/ai/analyze — одноразовый анализ сада =====
router.get('/analyze', async (req, res) => {
  try {
    const uid = req.user.id;

    // Rate limit
    const rate = await rateStatus(uid);
    if (rate.used >= RATE_LIMIT) {
      return res.status(429).json({ error: rateLimitMessage(rate.used, rate.waitSec) });
    }

    // Собираем досье сада (с учётом сезона)
    const seasonStart = await getUserSeasonStart(uid);
    const context = await buildContext(uid, seasonStart);

    // Формируем промпт
    const messages = [
      { role: 'system', text: SYSTEM_PROMPT },
      { role: 'user', text: `Досье сада:\n\n${context}\n\nПроанализируй и дай структурированный отчёт:\n1. 🚨 Срочное (что делать прямо сейчас)\n2. ⚠️ Внимание (что может пойти не так)\n3. 📋 По каждой культуре — статус и рекомендации\n4. 💡 Советы по таре и пересадке` },
    ];

    const answer = await complete(messages, { maxTokens: 1500 });

    // Записываем в историю
    await saveMessage(uid, 'user', '[Анализ сада]', 'analyze');
    await saveMessage(uid, 'assistant', answer, 'analyze');

    res.json({ answer });
  } catch (err) {
    console.error('AI analyze error:', err.message);
    const status = err instanceof YandexGptError ? err.status : 500;
    res.status(status).json({ error: err.message });
  }
});

// ===== POST /api/ai/ask — чат =====
router.post('/ask', async (req, res) => {
  try {
    const uid = req.user.id;
    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Введите вопрос' });
    }

    // Rate limit
    const rate = await rateStatus(uid);
    if (rate.used >= RATE_LIMIT) {
      return res.status(429).json({ error: rateLimitMessage(rate.used, rate.waitSec) });
    }

    // Собираем досье сада (с учётом сезона)
    const seasonStart = await getUserSeasonStart(uid);
    const context = await buildContext(uid, seasonStart);

    // Загружаем историю чата (только kind='ask')
    const historyResult = await pool.query(
      `SELECT role, content FROM ai_messages
       WHERE user_id = $1 AND kind = 'ask'
       ORDER BY created_at DESC
       LIMIT 10`,
      [uid]
    );
    const history = historyResult.rows.reverse();

    // Формируем messages: system + досье сада + история + вопрос
    const messages = [
      { role: 'system', text: `${SYSTEM_PROMPT}\n\n${context}` },
      ...history.map((m) => ({ role: m.role, text: m.content })),
      { role: 'user', text: question.trim() },
    ];

    const answer = await complete(messages, { maxTokens: 1200 });

    // Записываем в историю
    await saveMessage(uid, 'user', question.trim(), 'ask');
    await saveMessage(uid, 'assistant', answer, 'ask');

    res.json({ answer });
  } catch (err) {
    console.error('AI ask error:', err.message);
    const status = err instanceof YandexGptError ? err.status : 500;
    res.status(status).json({ error: err.message });
  }
});

// ===== GET /api/ai/history — история чата =====
router.get('/history', async (req, res) => {
  try {
    const uid = req.user.id;
    const result = await pool.query(
      `SELECT role, content, kind, EXTRACT(EPOCH FROM (NOW() - created_at))::int AS age_sec
       FROM ai_messages WHERE user_id = $1 AND kind = 'ask'
       ORDER BY created_at ASC`,
      [uid]
    );
    res.json({ history: result.rows });
  } catch (err) {
    console.error('AI history error:', err.message);
    res.status(500).json({ error: 'Ошибка загрузки истории' });
  }
});

// ===== DELETE /api/ai/history — очистить чат =====
router.delete('/history', async (req, res) => {
  try {
    const uid = req.user.id;
    await pool.query(
      `DELETE FROM ai_messages WHERE user_id = $1 AND kind = 'ask'`,
      [uid]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('AI clear error:', err.message);
    res.status(500).json({ error: 'Ошибка очистки истории' });
  }
});

module.exports = router;
