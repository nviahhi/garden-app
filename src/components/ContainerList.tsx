import { useContainerStore } from '../store/useContainerStore';

interface ContainerListProps {
  selectedId: number | null;
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

const PX_PER_CM = 20;
const pxToCm = (px: number) => Math.round(px / PX_PER_CM);

export function ContainerList({
  selectedId,
  onSelect,
  onCreate,
  onSwitchToBatches,
}: ContainerListProps) {
  const containers = useContainerStore((s) => s.containers);
  const isLoading = useContainerStore((s) => s.isLoading);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>🌱 Мой сад</h2>
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
          <p className="muted">Пока нет контейнеров</p>
        )}
        {containers.map((c) => (
          <button
            key={c.id}
            className={`list-item ${selectedId === c.id ? 'is-active' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            <div className="list-item-name">{c.name}</div>
            <div className="list-item-meta">
              {TYPE_LABELS[c.type] ?? c.type} · {pxToCm(c.width)}×{pxToCm(c.height)} см
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}