import { useState } from 'react';
import { useBatchStore } from '../store/useBatchStore';
import { useContainerStore } from '../store/useContainerStore';
import {
  PLANT_STATUS_LABELS,
  PLANT_STATUS_EMOJI,
  type Plant,
  type PlantStatus,
} from '../types';

// Фиксируем момент старта сессии — не вызываем Date.now() в рендере
const SESSION_STARTED_AT = Date.now();

interface PlantInfoPanelProps {
  plant: Plant;
  onClose: () => void;
  onTransplant: (plant: Plant) => void;
}

const EVENT_LABELS: Record<string, string> = {
  transplant: 'Пересадка',
  note: 'Заметка',
  measure: 'Замер',
  water: 'Полив',
};

const STATUS_ORDER: PlantStatus[] = ['sown', 'growing', 'flowering', 'fruiting', 'done'];

export function PlantInfoPanel({ plant, onClose, onTransplant }: PlantInfoPanelProps) {
  const allPlants = useBatchStore((s) => s.plants);
  const allBatches = useBatchStore((s) => s.batches);
  const setStatus = useBatchStore((s) => s.setPlantStatus);
  const removePlant = useBatchStore((s) => s.removePlant);
  const addEvent = useBatchStore((s) => s.addPlantEvent);

  const containers = useContainerStore((s) => s.containers);

  const [noteText, setNoteText] = useState('');
  const [isAddingNote, setAddingNote] = useState(false);

  const currentPlant = allPlants.find((p) => p.id === plant.id) ?? plant;
  const batch = allBatches.find((b) => b.id === currentPlant.batch_id);
  const container = containers.find((c) => c.id === currentPlant.container_id);

  const ageDays = batch
    ? Math.floor(
        (SESSION_STARTED_AT - new Date(batch.sowing_date).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  const handleStatusChange = async (status: PlantStatus) => {
    if (status === currentPlant.status) return;
    await setStatus(currentPlant.id, status);
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    const ok = await addEvent(currentPlant.id, 'note', noteText.trim());
    setAddingNote(false);
    if (ok) setNoteText('');
  };

  const handleDelete = async () => {
    if (confirm(`Удалить растение #${currentPlant.number}?`)) {
      await removePlant(currentPlant.id);
      onClose();
    }
  };

  return (
    <aside className="edit-panel">
      <div className="panel-header">
        <h3>Растение #{currentPlant.number}</h3>
        <button className="btn-icon" onClick={onClose} aria-label="Закрыть">×</button>
      </div>

      <div className="batch-card">
        <div className="batch-card-name">
          {currentPlant.species}
          {currentPlant.variety ? ` · ${currentPlant.variety}` : ''}
        </div>
        <div className="batch-card-row">
          <span className="batch-label">Статус:</span>
          <span>
            {PLANT_STATUS_EMOJI[currentPlant.status]}{' '}
            {PLANT_STATUS_LABELS[currentPlant.status] ?? currentPlant.status}
          </span>
        </div>
        {batch && (
          <div className="batch-card-row">
            <span className="batch-label">Посеяно:</span>
            <span>
              {new Date(batch.sowing_date).toLocaleDateString('ru-RU')}
              {ageDays != null && ` · ${ageDays} дн.`}
            </span>
          </div>
        )}
        <div className="batch-card-row">
          <span className="batch-label">Растёт в:</span>
          <span>
            {container?.name ?? '—'}
            {currentPlant.cell_index != null && ` · ячейка #${currentPlant.cell_index + 1}`}
          </span>
        </div>
      </div>

      {/* Действия */}
      <button
        className="btn btn-primary btn-block"
        onClick={() => onTransplant(currentPlant)}
      >
        🪴 Пересадить
      </button>

      {/* Переключение статуса */}
      <div className="status-switcher">
        <span className="status-switcher-label">Изменить статус:</span>
        <div className="status-switcher-list">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              className={`status-btn ${currentPlant.status === s ? 'is-active' : ''}`}
              onClick={() => handleStatusChange(s)}
              disabled={currentPlant.status === s}
              title={PLANT_STATUS_LABELS[s]}
            >
              <span className="status-btn-emoji">{PLANT_STATUS_EMOJI[s]}</span>
              <span className="status-btn-label">{PLANT_STATUS_LABELS[s]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Добавление заметки */}
      <div className="field">
        <span>Заметка</span>
        <textarea
          className="note-textarea"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Наблюдение, замер, что-то важное..."
          rows={2}
        />
        <button
          className="btn btn-ghost btn-block"
          onClick={handleAddNote}
          disabled={!noteText.trim() || isAddingNote}
        >
          {isAddingNote ? 'Сохраняю...' : 'Добавить заметку'}
        </button>
      </div>

      {/* История событий */}
      {currentPlant.events && currentPlant.events.length > 0 && (
        <div className="plant-history">
          <h4>История</h4>
          <div className="plant-history-list">
            {currentPlant.events.map((e) => (
              <div key={e.id} className="plant-event">
                <div className="plant-event-header">
                  <span className="plant-event-type">
                    {EVENT_LABELS[e.event_type] ?? e.event_type}
                  </span>
                  <span className="plant-event-date">
                    {new Date(e.event_date).toLocaleDateString('ru-RU')}
                  </span>
                </div>
                {e.event_type === 'transplant' && (
                  <div className="plant-event-detail">
                    {e.from_container_name ?? '?'} → {e.to_container_name ?? '?'}
                  </div>
                )}
                {e.notes && <div className="plant-event-notes">{e.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="btn btn-danger" onClick={handleDelete}>
        Удалить растение
      </button>
    </aside>
  );
}