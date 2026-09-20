import { useEffect, useState } from 'react';
import './App.css';
import { GardenCanvas } from './components/GardenCanvas';
import { ContainerList } from './components/ContainerList';
import { ContainerEditPanel } from './components/ContainerEditPanel';
import { ContainerCreateModal } from './components/ContainerCreateModal';
import { BatchCreateModal } from './components/BatchCreateModal';
import { useContainerStore } from './store/useContainerStore';
import { useBatchStore } from './store/useBatchStore';

function App() {
  const containers = useContainerStore((s) => s.containers);
  const loadBatches = useBatchStore((s) => s.loadBatches);
  const loadPlants = useBatchStore((s) => s.loadPlants);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isCreateContainerOpen, setCreateContainerOpen] = useState(false);
  const [isCreateBatchOpen, setCreateBatchOpen] = useState(false);

  const selectedContainer = containers.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    loadBatches();
    loadPlants();
  }, [loadBatches, loadPlants]);

  return (
    <div className="app-layout">
      <ContainerList
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreate={() => setCreateContainerOpen(true)}
      />

      <main className="canvas-area">
        <div className="canvas-toolbar">
          <button
            className="btn btn-primary"
            onClick={() => setCreateBatchOpen(true)}
          >
            + Новая партия
          </button>
        </div>
        <GardenCanvas selectedId={selectedId} onSelect={setSelectedId} />
      </main>

      {selectedContainer && (
        <ContainerEditPanel
          container={selectedContainer}
          onClose={() => setSelectedId(null)}
        />
      )}

      {isCreateContainerOpen && (
        <ContainerCreateModal onClose={() => setCreateContainerOpen(false)} />
      )}

      {isCreateBatchOpen && (
        <BatchCreateModal onClose={() => setCreateBatchOpen(false)} />
      )}
    </div>
  );
}

export default App;