import { useState } from 'react';
import './App.css';
import { GardenCanvas } from './components/GardenCanvas';
import { ContainerList } from './components/ContainerList';
import { ContainerEditPanel } from './components/ContainerEditPanel';
import { ContainerCreateModal } from './components/ContainerCreateModal';
import { useContainerStore } from './store/useContainerStore';

function App() {
  const containers = useContainerStore((s) => s.containers);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);

  const selectedContainer = containers.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="app-layout">
      <ContainerList
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreate={() => setCreateOpen(true)}
      />

      <main className="canvas-area">
        <GardenCanvas selectedId={selectedId} onSelect={setSelectedId} />
      </main>

      {selectedContainer && (
        <ContainerEditPanel
          container={selectedContainer}
          onClose={() => setSelectedId(null)}
        />
      )}

      {isCreateOpen && (
        <ContainerCreateModal onClose={() => setCreateOpen(false)} />
      )}
    </div>
  );
}

export default App;