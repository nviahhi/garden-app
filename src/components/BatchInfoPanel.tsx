import { useBatchStore } from '../store/useBatchStore';
import { PLANT_STATUS_LABELS, type Batch } from '../types';

interface BatchInfoPanelProps {
  batch: Batch;
  onClose: () => void;
  onGerminate: (batch: Batch) => void;
  onSelectBatch: (batch: Batch) => void;
}

export function BatchInfoPanel({
  batch,
  onClose,
  onGerminate,
  onSelectBatch,
}: BatchInfoPanelProps) {
  const removeBatch = useBatchStore((s) => s.removeBatch);
  const allBatches = useBatchStore((s) => s.batches);
  const allPlants = useBatchStore((s) => s.plants);

  // Партии того же контейнера
  const siblings = allBatches.filter(
    (b) => b.container_id != null && b.container_id === batch.container_id
  );

  // Растения этой партии — всегда актуальны из стора
  const batchPlants = allPlants
    .filter((p) => p.batch_id === batch.id)
    .sort((a, b) => a.number - b.number);

  const plantsCount = batchPlants.length;
  const remaining = Math.max(0, batch.seeds_count - plantsCount);
  const canGerminate = remaining > 0;

  const handleDelete = async () => {
    if (confirm(`Удалить партию «${batch.species}${batch.variety ? ' ' + batch.variety : ''}»?`)) {
      await removeBatch(batch.id);
      onClose();
    }
  };

  return (
    <aside className="edit-panel">
      <div className="panel-header">
        <h3>Партия</h3>
        <button className="btn-icon" onClick={onClose} aria-label="Закрыть">×</button>
      </div>

      {siblings.length > 1 && (
        <div className="batch-switcher">
          <span className="batch-switcher-label">Партии в контейнере:</span>
          <div className="batch-switcher-list">
            {siblings.map((b) => {
              const bPlants = allPlants.filter((p) => p.batch_id === b.id).length;
              return (
                <button
                  key={b.id}
                  className={`batch-switcher-item ${b.id === batch.id ? 'is-active' : ''}`}
                  onClick={() => onSelectBatch(b)}
                >
                  <span className="batch-switcher-name">
                    {b.species}{b.variety ? ` · ${b.variety}` : ''}
                  </span>
                  <span className="batch-switcher-meta">
                    🌰 {b.seeds_count} · {bPlants} раст.
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="batch-card">
        <div className="batch-card-name">
          {batch.species}
          {batch.variety ? ` · ${batch.variety}` : ''}
        </div>
        <div className="batch-card-row">
          <span className="batch-label">Посев:</span>
          <span>{new Date(batch.sowing_date).toLocaleDateString('ru-RU')}</span>
        </div>
        <div className="batch-card-row">
          <span className="batch-label">Семян:</span>
          <span>{batch.seeds_count}</span>
        </div>
        <div className="batch-card-row">
          <span className="batch-label">Контейнер:</span>
          <span>{batch.container_name ?? '—'}</span>
        </div>
        <div className="batch-card-row">
          <span className="batch-label">Растений:</span>
          <span>{plantsCount} из {batch.seeds_count}</span>
        </div>
        {batch.notes && (
          <div className="batch-card-notes">{batch.notes}</div>
        )}
      </div>

      {canGerminate && (
        <button className="btn btn-primary" onClick={() => onGerminate(batch)}>
          🌱 {plantsCount === 0 ? 'Отметить всходы' : `Добавить ещё (${remaining})`}
        </button>
      )}

      {!canGerminate && plantsCount > 0 && (
        <p className="muted" style={{ textAlign: 'center', fontSize: 12 }}>
          Все {batch.seeds_count} растений отмечены
        </p>
      )}

      {batchPlants.length > 0 && (
        <div className="batch-plants">
          <h4>Растения ({batchPlants.length})</h4>
          <div className="batch-plants-list">
            {batchPlants.map((p) => (
              <div key={p.id} className="batch-plant-item">
                <span className="batch-plant-num">#{p.number}</span>
                <span className="batch-plant-status">
                  {PLANT_STATUS_LABELS[p.status] ?? p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="btn btn-danger" onClick={handleDelete}>
        Удалить партию
      </button>
    </aside>
  );
}