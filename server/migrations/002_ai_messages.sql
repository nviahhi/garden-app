-- Миграция: таблица истории общения с ИИ
-- Запуск: psql -U garden_user -d garden_db -f server/migrations/002_ai_messages.sql

CREATE TABLE IF NOT EXISTS ai_messages (
  id       SERIAL PRIMARY KEY,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role     TEXT    NOT NULL CHECK (role IN ('user', 'assistant')),
  content  TEXT    NOT NULL,
  kind     TEXT    NOT NULL DEFAULT 'ask' CHECK (kind IN ('analyze', 'ask')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_user_created
  ON ai_messages (user_id, created_at DESC);
