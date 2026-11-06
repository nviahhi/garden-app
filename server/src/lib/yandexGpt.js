/**
 * Обёртка над Yandex Cloud AI Studio — Foundation Models / completion API.
 *
 * Секретный API-ключ живёт ТОЛЬКО в server/.env и никогда не уходит на клиент.
 * docs: https://aistudio.yandex.ru/ru/docs/ai-studio/operations/generation/completions-basic
 */

const ENDPOINT =
  'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';

/** Модель по умолчанию — Lite, самая дешёвая из адекватных. */
const DEFAULT_MODEL = 'yandexgpt-lite';

/** Таймаут запроса к Яндексу. Без него «зависшая» модалка держит клиента. */
const TIMEOUT_MS = 30_000;

class YandexGptError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'YandexGptError';
    this.status = status;
  }
}

/** Человекочитаемое объяснение кода ошибки Яндекса для UI. */
function describeStatus(status, body) {
  switch (status) {
    case 400:
      return 'Яндекс отклонил запрос (проверьте YANDEX_FOLDER_ID и имя модели).';
    case 401:
    case 403:
      return 'Яндекс отклонил ключ: проверьте YANDEX_API_KEY и роль ai.languageModels.user.';
    case 404:
      return 'Модель не найдена в этом каталоге. Проверьте YANDEX_FOLDER_ID.';
    case 429:
      return 'Превышен лимит запросов на стороне Яндекса. Попробуйте через минуту.';
    default:
      if (status >= 500) {
        return 'Сервис Яндекса временно недоступен. Попробуйте позже.';
      }
      return `Ошибка Яндекса (${status}).`;
  }
}

/**
 * Синхронная генерация.
 *
 * @param {Array<{role: string, text: string}>} messages
 * @param {{temperature?: number, maxTokens?: number, model?: string}} options
 * @returns {Promise<string>} текст ответа модели
 */
async function complete(messages, { temperature = 0.4, maxTokens = 1200, model } = {}) {
  const apiKey = process.env.YANDEX_API_KEY;
  const folderId = process.env.YANDEX_FOLDER_ID;

  if (!apiKey || !folderId) {
    throw new YandexGptError(
      'Не настроен доступ к ИИ: добавьте YANDEX_API_KEY и YANDEX_FOLDER_ID в server/.env',
      503
    );
  }

  const body = {
    modelUri: `gpt://${folderId}/${model ?? DEFAULT_MODEL}`,
    completionOptions: {
      stream: false,
      temperature,
      maxTokens: String(maxTokens),
    },
    messages,
  };

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Api-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new YandexGptError('Яндекс не ответил вовремя. Попробуйте ещё раз.', 504);
    }
    throw new YandexGptError('Не удалось связаться с сервисом Яндекса.', 502);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('YandexGPT error:', res.status, text.slice(0, 500));
    throw new YandexGptError(describeStatus(res.status, text), res.status);
  }

  const data = await res.json();
  const answer = data?.result?.alternatives?.[0]?.message?.text?.trim();

  if (!answer) {
    throw new YandexGptError('Модель вернула пустой ответ. Попробуйте переформулировать.', 502);
  }

  return answer;
}

module.exports = { complete, YandexGptError };
