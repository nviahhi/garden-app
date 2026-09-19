import { useContainerStore } from '../store/useContainerStore';
import { ContainerForm, type ContainerFormData } from './ContainerForm';

interface ContainerCreateModalProps {
  onClose: () => void;
}

export function ContainerCreateModal({ onClose }: ContainerCreateModalProps) {
  const addContainer = useContainerStore((s) => s.addContainer);

  const handleSubmit = async (data: ContainerFormData) => {
    await addContainer({
      ...data,
      x: 100,
      y: 100,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h3>Новый контейнер</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <ContainerForm
          onSubmit={handleSubmit}
          onCancel={onClose}
          submitLabel="Создать"
        />
      </div>
    </div>
  );
}