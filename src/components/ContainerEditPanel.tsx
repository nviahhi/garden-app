import type { Container } from '../types';
import { useContainerStore } from '../store/useContainerStore';
import { ContainerForm, type ContainerFormData } from './ContainerForm';

interface ContainerEditPanelProps {
  container: Container;
  onClose: () => void;
}

const NEW_POSITION_X = 20;
const NEW_POSITION_Y = 20;

export function ContainerEditPanel({ container, onClose }: ContainerEditPanelProps) {
  const updateContainer = useContainerStore((s) => s.updateContainer);
  const removeContainer = useContainerStore((s) => s.removeContainer);

  const handleSubmit = async (data: ContainerFormData) => {
    const updates: Partial<Container> = { ...data };

    // При смене зоны — в левый верхний угол новой зоны
    if (data.zone_id !== container.zone_id) {
      updates.x = NEW_POSITION_X;
      updates.y = NEW_POSITION_Y;
    }

    await updateContainer(container.id, updates);
    onClose();
  };

  const handleDelete = async () => {
    if (confirm(`Удалить «${container.name}»?`)) {
      await removeContainer(container.id);
      onClose();
    }
  };

  return (
    <aside className="edit-panel">
      <div className="panel-header">
        <h3>Редактирование</h3>
        <button className="btn-icon" onClick={onClose} aria-label="Закрыть">×</button>
      </div>

      <ContainerForm
        key={container.id}
        initial={container}
        onSubmit={handleSubmit}
        onCancel={onClose}
        submitLabel="Сохранить"
      />

      <button className="btn btn-danger" onClick={handleDelete}>
        Удалить контейнер
      </button>
    </aside>
  );
}