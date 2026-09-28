import { useBatchStore } from '../store/useBatchStore';
import { PLANT_STATUS_LABELS, type Batch, type Plant } from '../types';

interface BatchInfoPanelProps {
  batch: Batch;
  onClose: () => void;
  onGerminate: (batch: Batch) => void;
  onSelectBatch: (batch: Batch) => void;
  onTransplant: (plant: Plant) => void;
}

export function BatchInfoPanel({
  batch,
  onClose,
  onGerminate,
  onSelectBatch,
  onTransplant,
}: BatchInfoPanelProps) {
  const removeBatch = useBatchStore((s) => s.removeBatch);
  const markGerminated = useBatchStore((s) => s.markGerminated);
  const markPlantGerminated = useBatchStore((s) => s.markPlantGerminated);
  const allBatches = useBatchStore((s) => s.batches);
  const allPlants = useBatchStore((s) => s.plants);

  const siblings = allBatches.filter(
    (b) => b.container_id != null && b.container_id === batch.container_id
  );

  const batchPlants = allPlants
    .filter((p) => p.batch_id === batch.id)
    .sort((a, b) => (a.display_number ?? a.number) - (b.display_number ?? b.number));

  const plantsCount = batchPlants.length;
  const sownCount = batchPlants.filter((p) => p.status === 'sown').length;
  const germinatedCount = batchPlants.filter((p) => p.status !== 'sown').length;
  
  const canCreatePlants = plantsCount === 0 && batch.seeds_count > 0 && batch.container_id != null;
  const canMarkGerminated = sownCount > 0;

  const handleDelete = async () => {
    if (confirm(`Удалить партию «${batch.species}${batch.variety ? ' ' + batch.variety : ''}»?`)) {
      await removeBatch(batch.id);
      onClose();
    }
  };

  const handleMarkGerminated = async () => {
    await markGerminated(batch.id);
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
          <span>{batch.container_name ?? (batch.container_id === null ? 'группа горшков' : '—')}</span>
        </div>
        {batchPlants.length > 0 && (
          <div className="batch-card-row">
            <span className="batch-label">Взошло:</span>
            <span>{germinatedCount} из {batch.seeds_count}</span>
          </div>
        )}
        {batch.notes && (
          <div className="batch-card-notes">{batch.notes}</div>
        )}
      </div>

      {canCreatePlants && (
        <button className="btn btn-primary" onClick={() => onGerminate(batch)}>
          🌱 Отметить всходы
        </button>
      )}

      {canMarkGerminated && (
        <button className="btn btn-primary" onClick={handleMarkGerminated}>
          🌱 Отметить всех взошедшими ({sownCount})
        </button>
      )}

      {batchPlants.length > 0 && (
        <div className="batch-plants">
          <h4>Растения ({batchPlants.length})</h4>
          <div className="batch-plants-list">
            {batchPlants.map((p) => (
              <div key={p.id} className="batch-plant-item">
                <div className="batch-plant-info">
                  <span className="batch-plant-num">
                    #{p.display_number ?? p.number}
                    {p.container_name && (
                      <span className="batch-plant-container"> · {p.container_name}</span>
                    )}
                  </span>
                  <span className="batch-plant-status">
                    {PLANT_STATUS_LABELS[p.status] ?? p.status}
                  </span>
                </div>
                <div className="batch-plant-actions">
                  {p.status === 'sown' && (
                    <button
                      className="btn-icon-sm"
                      title="Отметить взошедшим"
                      onClick={() => markPlantGerminated(p.id)}
                    >
                      🌱
                    </button>
                  )}
                  {p.status !== 'done' && (
                    <button
                      className="btn-sm"
                      onClick={() => onTransplant(p)}
                    >
                      Пересадить
                    </button>
                  )}
                </div>
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