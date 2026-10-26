import { useState } from 'react';
import { useBatchStore } from '../store/useBatchStore';
import { useContainerStore } from '../store/useContainerStore';
import { useZoneStore } from '../store/useZoneStore';

type Mode = 'scattered' | 'cells' | 'pots';

interface BatchCreateModalProps {
  onClose: () => void;
  presetContainerId?: number;
}

export function BatchCreateModal({ onClose, presetContainerId }: BatchCreateModalProps) {
  const allContainers = useContainerStore((s) => s.containers);
  const plants = useBatchStore((s) => s.plants);
  const createBatch = useBatchStore((s) => s.createBatch);
  const currentZone = useZoneStore((s) => s.currentZone);

  // Только контейнеры текущей зоны
  const containers = allContainers.filter((c) => c.zone_id === currentZone?.id);

  const [species, setSpecies] = useState('');
  const [variety, setVariety] = useState('');
  const [sowingDate, setSowingDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [seedsCount, setSeedsCount] = useState(10);
  const [containerId, setContainerId] = useState<number | ''>(
    presetContainerId ?? ''
  );
  const [selectedPots, setSelectedPots] = useState<number[]>([]);
  const [selectedCells, setSelectedCells] = useState<number[]>([]);
  const [mode, setMode] = useState<Mode>('scattered');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedContainer = containers.find((c) => c.id === containerId);
  const hasGrid = !!(selectedContainer?.cols && selectedContainer?.rows);
  const totalCells = hasGrid
    ? selectedContainer!.cols! * selectedContainer!.rows!
    : 0;

  // Занятые ячейки — вычисляем напрямую (без useMemo).
  // Это дёшево: Set на нескольких десятках растений.
  const occupiedCells = new Set<number>();
  if (selectedContainer) {
    for (const p of plants) {
      if (p.container_id === selectedContainer.id && p.cell_index !== null) {
        occupiedCells.add(p.cell_index);
      }
    }
  }

  const freeCellsCount = totalCells - occupiedCells.size;

  // Эффективный режим (derived state, без useState/useEffect)
  let effectiveMode: Mode = mode;
  if (mode === 'cells' && !hasGrid) effectiveMode = 'scattered';
  if (mode === 'pots' && containers.length === 0) effectiveMode = 'scattered';

  // ===== Обработчики смены селектов — сбрасываем зависимое состояние =====
  const handleContainerChange = (value: number | '') => {
    setContainerId(value);
    setSelectedCells([]);
    setError(null);
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setError(null);

    if (newMode === 'cells') {
      // Если выбранный контейнер без сетки — подставить первый с сеткой
      if (!selectedContainer?.cols || !selectedContainer?.rows) {
        const gridContainer = containers.find((c) => c.cols && c.rows);
        if (gridContainer) {
          setContainerId(gridContainer.id);
          setSelectedCells([]);
        }
      }
    }
  };

  const togglePot = (id: number) => {
    setSelectedPots((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleCell = (cellIndex: number) => {
    if (occupiedCells.has(cellIndex)) return;
    setSelectedCells((prev) =>
      prev.includes(cellIndex)
        ? prev.filter((c) => c !== cellIndex)
        : [...prev, cellIndex]
    );
  };

  const handleSelectAllFree = () => {
    const free: number[] = [];
    for (let i = 0; i < totalCells; i++) {
      if (!occupiedCells.has(i)) free.push(i);
    }
    setSelectedCells(free);
  };

  const handleClearCells = () => {
    setSelectedCells([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!species.trim()) return;

    const payload: Parameters<typeof createBatch>[0] = {
      species: species.trim(),
      variety: variety.trim() || undefined,
      sowing_date: sowingDate,
      seeds_count: seedsCount,
      notes: notes.trim() || undefined,
    };

    if (effectiveMode === 'scattered') {
      if (!containerId) {
        setError('Выберите контейнер');
        return;
      }
      payload.container_id = Number(containerId);
    } else if (effectiveMode === 'cells') {
      if (!selectedContainer) {
        setError('Выберите кассету');
        return;
      }
      if (selectedCells.length === 0) {
        setError('Выберите хотя бы одну ячейку');
        return;
      }
      payload.container_id = selectedContainer.id;
      payload.cell_indices = selectedCells;
      payload.seeds_count = selectedCells.length;
    } else if (effectiveMode === 'pots') {
      if (selectedPots.length === 0) {
        setError('Выберите хотя бы один горшок');
        return;
      }
      payload.container_ids = selectedPots;
      payload.seeds_count = selectedPots.length;
    }

    setSubmitting(true);
    const result = await createBatch(payload);
    setSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error ?? 'Не удалось создать партию');
    }
  };

  const dropdownContainers =
    effectiveMode === 'cells'
      ? containers.filter((c) => c.cols && c.rows)
      : containers;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h3>Новая партия</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
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

            {effectiveMode !== 'cells' && effectiveMode !== 'pots' && (
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
            )}
          </div>

          {/* Режим */}
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

              {containers.some((c) => c.cols && c.rows) && (
                <label className="radio">
                  <input
                    type="radio"
                    checked={effectiveMode === 'cells'}
                    onChange={() => handleModeChange('cells')}
                  />
                  По ячейкам кассеты
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

          {/* Контейнер для россыпи и ячеек */}
          {(effectiveMode === 'scattered' || effectiveMode === 'cells') && (
            <label className="field">
              <span>Контейнер</span>
              <select
                value={containerId}
                onChange={(e) =>
                  handleContainerChange(
                    e.target.value ? Number(e.target.value) : ''
                  )
                }
              >
                <option value="">— выберите контейнер —</option>
                {dropdownContainers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.cols && c.rows ? ` — ${c.cols}×${c.rows}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Сетка ячеек для режима "по ячейкам" */}
          {effectiveMode === 'cells' && selectedContainer && hasGrid && (
            <div className="field">
              <div className="cell-picker-header">
                <span>
                  Выберите ячейки · выбрано{' '}
                  <strong>{selectedCells.length}</strong> из {freeCellsCount}{' '}
                  свободных
                </span>
                <div className="cell-picker-actions">
                  <button
                    type="button"
                    className="btn-sm"
                    onClick={handleSelectAllFree}
                    disabled={freeCellsCount === 0}
                  >
                    Все свободные
                  </button>
                  <button
                    type="button"
                    className="btn-sm"
                    onClick={handleClearCells}
                    disabled={selectedCells.length === 0}
                  >
                    Сбросить
                  </button>
                </div>
              </div>

              <div
                className="cell-grid"
                style={{
                  gridTemplateColumns: `repeat(${selectedContainer.cols}, 1fr)`,
                }}
              >
                {Array.from({ length: totalCells }).map((_, i) => {
                  const isOccupied = occupiedCells.has(i);
                  const isSelected = selectedCells.includes(i);

                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={isOccupied}
                      className={`cell-cell ${isOccupied ? 'is-occupied' : ''} ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => toggleCell(i)}
                      title={
                        isOccupied
                          ? `Ячейка #${i + 1} занята`
                          : `Ячейка #${i + 1}`
                      }
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>

              <span className="field-hint">
                Серые ячейки заняты. Нажмите на свободные, чтобы выбрать.
              </span>
            </div>
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

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!species.trim() || submitting}
            >
              {submitting ? 'Создаю...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}