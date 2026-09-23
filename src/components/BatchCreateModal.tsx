import { useState } from 'react';
import { useBatchStore } from '../store/useBatchStore';
import { useContainerStore } from '../store/useContainerStore';

interface BatchCreateModalProps {
  onClose: () => void;
  presetContainerId?: number;
}

type Mode = 'scattered' | 'cells' | 'pots';

export function BatchCreateModal({ onClose, presetContainerId }: BatchCreateModalProps) {
  const containers = useContainerStore((s) => s.containers);
  const createBatch = useBatchStore((s) => s.createBatch);

  const [species, setSpecies] = useState('');
  const [variety, setVariety] = useState('');
  const [sowingDate, setSowingDate] = useState(new Date().toISOString().slice(0, 10));
  const [seedsCount, setSeedsCount] = useState(10);
  const [containerId, setContainerId] = useState<number | ''>(presetContainerId ?? '');
  const [selectedPots, setSelectedPots] = useState<number[]>([]);
  const [mode, setMode] = useState<Mode>('scattered');
  const [notes, setNotes] = useState('');

  // Контейнеры с сеткой (для режима «по ячейкам»)
  const gridContainers = containers.filter((c) => c.cols && c.rows);
  const hasGrid = gridContainers.length > 0;

  const selectedContainer = containers.find((c) => c.id === containerId);
  const selectedHasGrid = !!(selectedContainer?.cols && selectedContainer?.rows);

  // Эффективный режим
  let effectiveMode: Mode = mode;
  if (mode === 'cells' && !hasGrid) effectiveMode = 'scattered';
  if (mode === 'pots' && containers.length === 0) effectiveMode = 'scattered';

  // При переключении в режим «по ячейкам» — если текущий контейнер без сетки,
  // автоматически выбираем первый контейнер с сеткой
  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    if (newMode === 'cells') {
      if (!selectedHasGrid && gridContainers.length > 0) {
        setContainerId(gridContainers[0].id);
      }
    }
  };

  const togglePot = (id: number) => {
    setSelectedPots((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!species.trim()) return;

    const payload: Parameters<typeof createBatch>[0] = {
      species: species.trim(),
      variety: variety.trim() || undefined,
      sowing_date: sowingDate,
      seeds_count: seedsCount,
      notes: notes.trim() || undefined,
    };

    if (effectiveMode === 'scattered') {
      payload.container_id = containerId ? Number(containerId) : undefined;
    } else if (effectiveMode === 'cells' && selectedContainer) {
      const total = selectedContainer.cols! * selectedContainer.rows!;
      const count = Math.min(seedsCount, total);
      payload.container_id = selectedContainer.id;
      payload.cell_indices = Array.from({ length: count }, (_, i) => i);
      payload.seeds_count = count;
    } else if (effectiveMode === 'pots') {
      if (selectedPots.length === 0) return;
      payload.container_ids = selectedPots;
      payload.seeds_count = selectedPots.length;
    }

    const ok = await createBatch(payload);
    if (ok) onClose();
  };

  // Список контейнеров для дропдауна — в режиме ячеек только с сеткой
  const dropdownContainers = effectiveMode === 'cells' ? gridContainers : containers;

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
              {effectiveMode === 'pots' ? (
                <>
                  <input
                    type="text"
                    value={`${selectedPots.length}`}
                    readOnly
                    className="field-narrow field-readonly"
                  />
                  <span className="field-hint">по числу выбранных горшков</span>
                </>  
              ) : (
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={seedsCount}
                  onChange={(e) => setSeedsCount(Number(e.target.value))}
                  className="field-narrow"
                />
              )}
            </label>
          </div>

          {/* Выбор режима */}
          <div className="field">
            <span>Как сеем?</span>
            <div className="radio-group">
              <label className="radio">
                <input
                  type="radio"
                  checked={effectiveMode === 'scattered'}
                  onChange={() => handleModeChange('scattered')}
                />
                Россыпью в контейнер
              </label>

              {hasGrid && (
                <label className="radio">
                  <input
                    type="radio"
                    checked={effectiveMode === 'cells'}
                    onChange={() => handleModeChange('cells')}
                  />
                  По ячейкам контейнера
                </label>
              )}

              {containers.length > 0 && (
                <label className="radio">
                  <input
                    type="radio"
                    checked={effectiveMode === 'pots'}
                    onChange={() => handleModeChange('pots')}
                  />
                  По отдельным горшкам
                </label>
              )}
            </div>
          </div>

          {/* Контейнер — для scattered и cells */}
          {(effectiveMode === 'scattered' || effectiveMode === 'cells') && (
            <label className="field">
              <span>
                Контейнер
                {effectiveMode === 'cells' && selectedContainer?.cols && selectedContainer?.rows && (
                  <> · {selectedContainer.cols}×{selectedContainer.rows}</>
                )}
              </span>
              <select
                value={containerId}
                onChange={(e) => setContainerId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">— не выбран —</option>
                {dropdownContainers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                    {c.cols && c.rows ? ` — ${c.cols}×${c.rows}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* По горшкам — мультивыбор */}
          {effectiveMode === 'pots' && (
            <div className="field">
              <span>Выберите горшки ({selectedPots.length} выбрано)</span>
              <div className="pots-list">
                {containers.map((c) => (
                  <label key={c.id} className="pot-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedPots.includes(c.id)}
                      onChange={() => togglePot(c.id)}
                    />
                    <span>{c.name}</span>
                    <span className="pot-type">{c.type}</span>
                  </label>
                ))}
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
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!species.trim() || (effectiveMode === 'pots' && selectedPots.length === 0)}
            >
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}