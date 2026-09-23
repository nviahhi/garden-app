import { useBatchStore } from '../store/useBatchStore';
import type { Batch } from '../types';

interface BatchListProps {
  selectedId: number | null;
  onSelect: (batch: Batch) => void;
  onCreate: () => void;
  onSwitchToContainers: () => void;
}

export function BatchList({
  selectedId,
  onSelect,
  onCreate,
  onSwitchToContainers,
}: BatchListProps) {
  const batches = useBatchStore((s) => s.batches);
  const plants = useBatchStore((s) => s.plants);
  const isLoading = useBatchStore((s) => s.isLoading);

  const sorted = [...batches].sort((a, b) => {
    return new Date(b.sowing_date).getTime() - new Date(a.sowing_date).getTime();
  });

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>🌱 Мой сад</h2>
      </div>

      <div className="sidebar-tabs">
        <button className="sidebar-tab" onClick={onSwitchToContainers}>
          Контейнеры
        </button>
        <button className="sidebar-tab is-active">Партии</button>
      </div>

      <button className="btn btn-primary btn-block" onClick={onCreate}>
        + Новая партия
      </button>

      <div className="sidebar-list">
        {isLoading && <p className="muted">Загрузка...</p>}
        {!isLoading && sorted.length === 0 && (
          <p className="muted">Пока нет партий</p>
        )}

        {sorted.map((batch) => {
          const batchPlants = plants.filter((p) => p.batch_id === batch.id);

          const germinated = batchPlants.filter(
            (p) => p.status !== 'sown' && p.status !== 'dead'
          ).length;

          // Иконка по статусу
          let icon: string;
          if (batchPlants.length === 0) icon = '🌰';
          else if (germinated === 0) icon = '🌰';
          else if (germinated === batch.seeds_count) icon = '🌿';
          else icon = '🌱';

          // Где растёт
          let place: string;
          if (batch.container_id === null) {
            const containerCount = new Set(
              batchPlants
                .map((p) => p.container_id)
                .filter((id): id is number => id != null)
            ).size;
            place = `${containerCount} горшк${containerCount === 1 ? '' : 'ов'}`;
          } else {
            place = batch.container_name ?? '—';
          }

          return (
            <button
              key={batch.id}
              className={`list-item ${selectedId === batch.id ? 'is-active' : ''}`}
              onClick={() => onSelect(batch)}
            >
              <div className="list-item-name">
                <span className="list-item-icon">{icon}</span>
                {batch.species}
                {batch.variety ? ` · ${batch.variety}` : ''}
              </div>
              <div className="list-item-meta">
                {germinated}/{batch.seeds_count} · {place}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}