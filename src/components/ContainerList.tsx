import { useContainerStore } from '../store/useContainerStore';
import { useZoneStore } from '../store/useZoneStore';
import type { Container } from '../types';

interface ContainerListProps {
  selectedId: number | null;
  zoneId: number | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onSwitchToBatches: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  pot: 'Горшок',
  tray: 'Кассета',
  bed: 'Грядка',
  greenhouse: 'Теплица',
};

export function ContainerList({
  selectedId,
  zoneId,
  onSelect,
  onCreate,
  onSwitchToBatches,
}: ContainerListProps) {
  const allContainers = useContainerStore((s) => s.containers);
  const isLoading = useContainerStore((s) => s.isLoading);
  const currentZone = useZoneStore((s) => s.currentZone);

  const pxPerCm = currentZone?.px_per_cm ?? 10;

  // Формат размера: грядки — в метрах, остальное — в см
  const formatSize = (c: Container) => {
    if (c.type === 'bed') {
      const wM = (c.width / pxPerCm / 100).toFixed(1);
      const hM = (c.height / pxPerCm / 100).toFixed(1);
      return `${wM}×${hM} м`;
    }
    const w = Math.round(c.width / pxPerCm);
    const h = Math.round(c.height / pxPerCm);
    return `${w}×${h} см`;
  };

  const containers = allContainers.filter((c) => c.zone_id === zoneId);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>🌱 Журнал рассады</h2>
      </div>

      <div className="sidebar-tabs">
        <button className="sidebar-tab is-active">Контейнеры</button>
        <button className="sidebar-tab" onClick={onSwitchToBatches}>Партии</button>
      </div>

      <button className="btn btn-primary btn-block" onClick={onCreate}>
        + Добавить контейнер
      </button>

      <div className="sidebar-list">
        {isLoading && <p className="muted">Загрузка...</p>}
        {!isLoading && containers.length === 0 && (
          <p className="muted">В этой зоне пока нет контейнеров</p>
        )}
        {containers.map((c) => (
          <button
            key={c.id}
            className={`list-item ${selectedId === c.id ? 'is-active' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            <div className="list-item-name">{c.name}</div>
            <div className="list-item-meta">
              {TYPE_LABELS[c.type] ?? c.type} · {formatSize(c)}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}