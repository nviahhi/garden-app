import { useState } from 'react';
import { useBatchStore } from '../store/useBatchStore';
import type { Batch } from '../types';

interface GerminateModalProps {
  batch: Batch;
  alreadyGerminated: number;   // ← сколько уже создано растений
  onClose: () => void;
}

export function GerminateModal({
  batch,
  alreadyGerminated,
  onClose,
}: GerminateModalProps) {
  const germinateBatch = useBatchStore((s) => s.germinateBatch);

  const remaining = Math.max(0, batch.seeds_count - alreadyGerminated);
  const [count, setCount] = useState(remaining);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (count < 1 || count > remaining) return;

    setLoading(true);
    const ok = await germinateBatch(batch.id, count);
    setLoading(false);

    if (ok) onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h3>{alreadyGerminated === 0 ? 'Отметить всходы' : 'Добавить всходы'}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Закрыть">×</button>
        </div>

        <div className="batch-summary">
          <div className="batch-summary-name">
            {batch.species}
            {batch.variety ? ` · ${batch.variety}` : ''}
          </div>
          <div className="batch-summary-meta">
            Посеяно {batch.seeds_count} семян · уже взошло {alreadyGerminated}
          </div>
        </div>

        {remaining === 0 ? (
          <p className="muted" style={{ textAlign: 'center' }}>
            Все семена уже отмечены как взошедшие.
          </p>
        ) : (
          <form className="container-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Сколько новых ростков появилось?</span>
              <input
                type="number"
                min={1}
                max={remaining}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                autoFocus
                className="field-narrow"
              />
              <span className="field-hint">
                Осталось отметить: {remaining}
              </span>
            </label>

            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
                Отмена
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || count < 1 || count > remaining}
              >
                {loading ? 'Сохраняю...' : `Добавить ${count}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}