import { useState } from 'react';
import { useContainerStore } from '../store/useContainerStore';
import { useBatchStore } from '../store/useBatchStore';
import type { Plant } from '../types';

interface TransplantModalProps {
  plant: Plant;
  onClose: () => void;
}

export function TransplantModal({ plant, onClose }: TransplantModalProps) {
  const containers = useContainerStore((s) => s.containers);
  const transplantPlant = useBatchStore((s) => s.transplantPlant);

  // Исключаем текущий контейнер
  const availableContainers = containers.filter((c) => c.id !== plant.container_id);

  const [targetId, setTargetId] = useState<number | ''>('');
  const [cellIndex, setCellIndex] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const target = containers.find((c) => c.id === targetId);
  const hasGrid = !!(target?.cols && target?.rows);
  const totalCells = hasGrid ? target!.cols! * target!.rows! : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) return;

    setLoading(true);
    const ok = await transplantPlant(
      plant.id,
      Number(targetId),
      hasGrid && cellIndex !== '' ? Number(cellIndex) : undefined,
      notes.trim() || undefined
    );
    setLoading(false);

    if (ok) onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h3>Пересадка растения #{plant.number}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Закрыть">×</button>
        </div>

        <div className="batch-summary">
          <div className="batch-summary-name">
            {plant.species}
            {plant.variety ? ` · ${plant.variety}` : ''}
          </div>
          <div className="batch-summary-meta">
            Сейчас: {plant.container_name ?? '—'}
            {plant.cell_index != null && ` · ячейка #${plant.cell_index + 1}`}
          </div>
        </div>

        <form className="container-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Куда пересаживаем? *</span>
            <select
              value={targetId}
              onChange={(e) => {
                setTargetId(e.target.value ? Number(e.target.value) : '');
                setCellIndex('');
              }}
              autoFocus
            >
              <option value="">— выберите контейнер —</option>
              {availableContainers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                  {c.cols && c.rows ? ` — ${c.cols}×${c.rows}` : ''}
                </option>
              ))}
            </select>
          </label>

          {hasGrid && (
            <label className="field">
              <span>Ячейка (0 — авто)</span>
              <input
                type="number"
                min={0}
                max={totalCells - 1}
                value={cellIndex}
                onChange={(e) => setCellIndex(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="—"
                className="field-narrow"
              />
              <span className="field-hint">
                Всего ячеек: {totalCells}
              </span>
            </label>
          )}

          <label className="field">
            <span>Заметка</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Необязательно"
            />
          </label>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!targetId || loading}
            >
              {loading ? 'Пересаживаю...' : 'Пересадить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}