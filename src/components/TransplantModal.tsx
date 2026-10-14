import { useState } from 'react';
import { useContainerStore } from '../store/useContainerStore';
import { useBatchStore } from '../store/useBatchStore';
import { useZoneStore } from '../store/useZoneStore';
import type { Plant } from '../types';

interface TransplantModalProps {
  plant: Plant;
  onClose: () => void;
}

export function TransplantModal({ plant, onClose }: TransplantModalProps) {
  const containers = useContainerStore((s) => s.containers);
  const transplantPlant = useBatchStore((s) => s.transplantPlant);
  const zones = useZoneStore((s) => s.zones);
  const currentZone = useZoneStore((s) => s.currentZone);

  // Исключаем текущий контейнер
  const availableContainers = containers
    .filter((c) => c.id !== plant.container_id)
    .sort((a, b) => {
      const aInCurrent = a.zone_id === currentZone?.id ? 0 : 1;
      const bInCurrent = b.zone_id === currentZone?.id ? 0 : 1;
      return aInCurrent - bInCurrent;
    });

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
          <h3>Пересадка растения #{plant.display_number ?? plant.number}</h3>
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
              {(() => {
                // Сортируем зоны: текущая — первая
                const sortedZones = [...zones].sort((a, b) => {
                  const aIsCurrent = a.id === currentZone?.id ? 0 : 1;
                  const bIsCurrent = b.id === currentZone?.id ? 0 : 1;
                  return aIsCurrent - bIsCurrent;
                });

                return sortedZones.map((zone) => {
                  const zoneContainers = availableContainers.filter(
                    (c) => c.zone_id === zone.id
                  );
                  if (zoneContainers.length === 0) return null;

                  const isCurrent = zone.id === currentZone?.id;
                  const label = isCurrent ? `${zone.name} (текущая)` : zone.name;

                  return (
                    <optgroup key={zone.id} label={label}>
                      {zoneContainers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.cols && c.rows ? ` — ${c.cols}×${c.rows}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  );
                });
              })()}
            </select>
          </label>

          {hasGrid && (
            <label className="field">
              <span>Номер ячейки (1–{totalCells})</span>
              <input
                type="number"
                min={1}
                max={totalCells}
                value={cellIndex === '' ? '' : cellIndex + 1}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setCellIndex('');
                  } else {
                    const num = Number(val);
                    setCellIndex(Math.max(0, Math.min(totalCells - 1, num - 1)));
                  }
                }}
                placeholder="—"
                className="field-narrow"
              />
              <span className="field-hint">
                Необязательно. Если не указать — займёт первую свободную.
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