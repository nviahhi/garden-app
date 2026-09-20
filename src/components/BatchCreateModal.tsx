import { useState } from 'react';
import { useBatchStore } from '../store/useBatchStore';
import { useContainerStore } from '../store/useContainerStore';

interface BatchCreateModalProps {
  onClose: () => void;
  presetContainerId?: number;
}

export function BatchCreateModal({ onClose, presetContainerId }: BatchCreateModalProps) {
  const containers = useContainerStore((s) => s.containers);
  const createBatch = useBatchStore((s) => s.createBatch);

  const [species, setSpecies] = useState('');
  const [variety, setVariety] = useState('');
  const [sowingDate, setSowingDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [seedsCount, setSeedsCount] = useState(10);
  const [containerId, setContainerId] = useState<number | ''>(presetContainerId ?? '');
  const [mode, setMode] = useState<'scattered' | 'cells'>('scattered');
  const [notes, setNotes] = useState('');

  // Находим выбранный контейнер (для проверки на ячейки)
  const selectedContainer = containers.find((c) => c.id === containerId);
  const hasGrid = !!(selectedContainer?.cols && selectedContainer?.rows);

  // Режим "по ячейкам" возможен только при наличии сетки.
  // Выводим эффективный режим из hasGrid вместо синхронизации состояния в эффекте.
  const effectiveMode = hasGrid ? mode : 'scattered';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!species.trim()) return;

    let cell_indices: number[] | undefined;

    if (effectiveMode === 'cells' && selectedContainer) {
      const total = selectedContainer.cols! * selectedContainer.rows!;
      const count = Math.min(seedsCount, total);
      cell_indices = Array.from({ length: count }, (_, i) => i);
    }

    const ok = await createBatch({
      species: species.trim(),
      variety: variety.trim() || undefined,
      sowing_date: sowingDate,
      seeds_count: seedsCount,
      container_id: containerId ? Number(containerId) : undefined,
      cell_indices,
      notes: notes.trim() || undefined,
    });

    if (ok) onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h3>Новая партия</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Закрыть">×</button>
        </div>

        <form className="container-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Культура *</span>
            <input
              type="text"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              placeholder="Например, томат"
              autoFocus
            />
          </label>

          <label className="field">
            <span>Сорт</span>
            <input
              type="text"
              value={variety}
              onChange={(e) => setVariety(e.target.value)}
              placeholder="Например, Черри"
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Дата посева *</span>
              <input
                type="date"
                value={sowingDate}
                onChange={(e) => setSowingDate(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Семян *</span>
              <input
                type="number"
                min={1}
                max={9999}
                value={seedsCount}
                onChange={(e) => setSeedsCount(Number(e.target.value))}
                className="field-narrow"
              />
            </label>
          </div>

          <label className="field">
            <span>Контейнер</span>
            <select
              value={containerId}
              onChange={(e) => setContainerId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">— не выбран —</option>
              {containers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          {hasGrid && (
            <div className="field">
              <span>Как сеем?</span>
              <div className="radio-group">
                <label className="radio">
                  <input
                    type="radio"
                    checked={effectiveMode === 'scattered'}
                    onChange={() => setMode('scattered')}
                  />
                  Россыпью в контейнер
                </label>
                <label className="radio">
                  <input
                    type="radio"
                    checked={effectiveMode === 'cells'}
                    onChange={() => setMode('cells')}
                  />
                  По ячейкам ({selectedContainer?.cols}×{selectedContainer?.rows})
                </label>
              </div>
            </div>
          )}

          <label className="field">
            <span>Заметки</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Необязательно"
            />
          </label>

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={!species.trim()}>
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}