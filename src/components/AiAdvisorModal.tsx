import { useState, useEffect } from 'react';
import axios from 'axios';
import { aiApi, type AiHistoryItem } from '../api/ai';

interface AiAdvisorModalProps {
  onClose: () => void;
}

type Tab = 'analyze' | 'ask';

/** Время в секундах → читаемый формат. */
function timeAgo(sec: number): string {
  if (sec < 60) return 'только что';
  if (sec < 3600) return `${Math.floor(sec / 60)} мин. назад`;
  return `${Math.floor(sec / 3600)} ч. назад`;
}

/** Сообщение об ошибке: сначала текст с сервера, потом текст axios. */
function extractError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const serverMsg = (err.response?.data as { error?: string })?.error;
    return serverMsg ?? err.message ?? fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

export function AiAdvisorModal({ onClose }: AiAdvisorModalProps) {
  const [tab, setTab] = useState<Tab>('analyze');

  // ===== Анализ =====
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeAnswer, setAnalyzeAnswer] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // ===== Спросить =====
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<AiHistoryItem[]>([]);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // ===== Вспомогательное =====
  const [clearing, setClearing] = useState(false);

  // Загрузка истории при открытии (независимо от вкладки — чтобы была готова)
  useEffect(() => {
    if (historyLoaded) return;
    aiApi.history()
      .then((d) => {
        setHistory(d.history);
        setHistoryLoaded(true);
      })
      .catch(() => {
        setChatError('Не удалось загрузить историю');
        setHistoryLoaded(true);
      });
  }, [historyLoaded]);

  // ===== Анализ =====
  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const { answer } = await aiApi.analyze();
      setAnalyzeAnswer(answer);
    } catch (err) {
      setAnalyzeError(extractError(err, 'Ошибка при анализе'));
    } finally {
      setAnalyzing(false);
    }
  };

  // ===== Отправка вопроса =====
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;

    setSending(true);
    setChatError(null);
    setQuestion('');

    // Оптимистично добавляем вопрос в историю
    const userMsg: AiHistoryItem = {
      role: 'user',
      content: q,
      kind: 'ask',
      age_sec: 0,
    };
    setHistory((h) => [...h, userMsg]);

    try {
      const { answer } = await aiApi.ask(q);
      setHistory((h) => [
        ...h,
        {
          role: 'assistant',
          content: answer,
          kind: 'ask',
          age_sec: 0,
        },
      ]);
    } catch (err) {
      // Убираем пользовательское сообщение при ошибке
      setHistory((h) => h.slice(0, -1));
      setChatError(extractError(err, 'Ошибка при отправке'));
    } finally {
      setSending(false);
    }
  };

  // ===== Очистка истории =====
  const handleClear = async () => {
    if (!confirm('Очистить историю переписки?')) return;
    setClearing(true);
    try {
      await aiApi.clearHistory();
      setHistory([]);
      setHistoryLoaded(false);
      setChatError(null);
    } catch {
      setChatError('Не удалось очистить историю');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ai-modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h3>🤖 Совет ИИ</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Закрыть">×</button>
        </div>

        {/* Вкладки */}
        <div className="ai-tabs">
          <button
            className={`ai-tab ${tab === 'analyze' ? 'is-active' : ''}`}
            onClick={() => setTab('analyze')}
          >
            Анализ
          </button>
          <button
            className={`ai-tab ${tab === 'ask' ? 'is-active' : ''}`}
            onClick={() => setTab('ask')}
          >
            Спросить
          </button>
        </div>

        {/* ===== Вкладка: Анализ ===== */}
        {tab === 'analyze' && (
          <div className="ai-body">
            {!analyzeAnswer && !analyzeError && (
              <div className="ai-analyze-empty">
                <p>
                  Запросите анализ вашего сада: ИИ посмотрит на растения,
                  статусы и даст рекомендации.
                </p>
                <button
                  className="btn btn-primary btn-block"
                  onClick={handleAnalyze}
                  disabled={analyzing}
                >
                  {analyzing ? '⏳ Анализирую...' : '🔍 Проанализировать сад'}
                </button>
              </div>
            )}

            {analyzeAnswer && (
              <div className="ai-answer">
                <p className="ai-answer-label">Результат анализа:</p>
                <div className="ai-answer-text">
                  {analyzeAnswer.split('\n').map((line, i) => (
                    <span key={i}>
                      {line}
                      <br />
                    </span>
                  ))}
                </div>
              </div>
            )}

            {analyzeError && (
              <div className="form-error">{analyzeError}</div>
            )}
          </div>
        )}

        {/* ===== Вкладка: Спросить ===== */}
        {tab === 'ask' && (
          <div className="ai-body ai-chat">
            {/* История */}
            <div className="ai-chat-history">
              {chatError && !historyLoaded && (
                <div className="form-error">{chatError}</div>
              )}

              {history.length === 0 && historyLoaded && (
                <div className="ai-chat-empty">
                  <p>Задайте вопрос о рассадке, пересадке, уходе.</p>
                </div>
              )}

              {history.map((msg, i) => (
                <div
                  key={i}
                  className={`ai-chat-msg ${
                    msg.role === 'assistant' ? 'is-assistant' : 'is-user'
                  }`}
                >
                  <div className="ai-chat-msg-label">
                    {msg.role === 'assistant' ? '🤖' : '👤'}{' '}
                    {msg.role === 'assistant' ? 'ИИ' : 'Вы'}
                  </div>
                  <div className="ai-chat-msg-content">
                    {msg.content.split('\n').map((line, j) => (
                      <span key={j}>
                        {line}
                        <br />
                      </span>
                    ))}
                  </div>
                  <div className="ai-chat-msg-time">
                    {msg.age_sec > 0 ? timeAgo(msg.age_sec) : 'сейчас'}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="ai-chat-msg is-assistant">
                  <div className="ai-chat-msg-label">🤖 ИИ</div>
                  <div className="ai-chat-msg-content ai-typing">
                    Думаю...
                  </div>
                </div>
              )}
            </div>

            {/* Форма ввода */}
            <form className="ai-chat-form" onSubmit={handleSend}>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Спросите о рассадке, пересадке..."
                disabled={sending}
                autoFocus
              />
              <button type="submit" disabled={sending || !question.trim()}>
                →
              </button>
            </form>

            {/* Кнопка очистки */}
            {history.length > 0 && (
              <button
                className="ai-clear-btn"
                onClick={handleClear}
                disabled={clearing}
              >
                {clearing ? 'Очищаю...' : 'Очистить историю'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
