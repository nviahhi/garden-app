import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { GardenCanvas } from './components/GardenCanvas';
import { ContainerList } from './components/ContainerList';
import { BatchList } from './components/BatchList';
import { ContainerEditPanel } from './components/ContainerEditPanel';
import { ContainerCreateModal } from './components/ContainerCreateModal';
import { BatchCreateModal } from './components/BatchCreateModal';
import { BatchInfoPanel } from './components/BatchInfoPanel';
import { GerminateModal } from './components/GerminateModal';
import { useContainerStore } from './store/useContainerStore';
import { useBatchStore } from './store/useBatchStore';
import { PLANT_STATUS_LABELS, type Plant, type Batch } from './types';

type SidebarTab = 'containers' | 'batches';

function App() {
  const containers = useContainerStore((s) => s.containers);
  const loadBatches = useBatchStore((s) => s.loadBatches);
  const loadPlants = useBatchStore((s) => s.loadPlants);
  const plants = useBatchStore((s) => s.plants);

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('containers');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [germinateBatch, setGerminateBatch] = useState<Batch | null>(null);

  const [isCreateContainerOpen, setCreateContainerOpen] = useState(false);
  const [isCreateBatchOpen, setCreateBatchOpen] = useState(false);

  const selectedContainer = containers.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    loadBatches();
    loadPlants();
  }, [loadBatches, loadPlants]);

  // Какие контейнеры подсветить по выбранной партии
  const highlightedContainerIds = useMemo(() => {
    if (!selectedBatch) return new Set<number>();

    const ids = new Set<number>();

    // Партия в одном контейнере (россыпь / ячейки)
    if (selectedBatch.container_id != null) {
      ids.add(selectedBatch.container_id);
    } else {
      // Партия распределена по горшкам — подсвечиваем все горшки,
      // где есть её растения
      for (const p of plants) {
        if (p.batch_id === selectedBatch.id && p.container_id != null) {
          ids.add(p.container_id);
        }
      }
    }

    return ids;
  }, [selectedBatch, plants]);

  const handlePlantClick = (plant: Plant) => {
    setSelectedPlant(plant);
    setSelectedBatch(null);
  };

  const handleBatchClick = (batch: Batch) => {
    setSelectedBatch(batch);
    setSelectedPlant(null);
    setSelectedId(null);
  };

  const handleContainerSelect = (id: number | null) => {
    setSelectedId(id);
    setSelectedBatch(null);
    setSelectedPlant(null);
  };

  return (
    <div className="app-layout">
      {sidebarTab === 'containers' ? (
        <ContainerList
          selectedId={selectedId}
          onSelect={handleContainerSelect}
          onCreate={() => setCreateContainerOpen(true)}
          onSwitchToBatches={() => setSidebarTab('batches')}
        />
      ) : (
        <BatchList
          selectedId={selectedBatch?.id ?? null}
          onSelect={handleBatchClick}
          onCreate={() => setCreateBatchOpen(true)}
          onSwitchToContainers={() => setSidebarTab('containers')}
        />
      )}

      <main className="canvas-area">
        <div className="canvas-toolbar">
          <button
            className="btn btn-primary"
            onClick={() => setCreateBatchOpen(true)}
          >
            + Новая партия
          </button>
        </div>
        <GardenCanvas
          selectedId={selectedId}
          onSelect={handleContainerSelect}
          onPlantClick={handlePlantClick}
          onBatchClick={handleBatchClick}
          highlightedContainerIds={highlightedContainerIds}
        />
      </main>

      {selectedContainer && !selectedBatch && !selectedPlant && (
        <ContainerEditPanel
          container={selectedContainer}
          onClose={() => setSelectedId(null)}
        />
      )}

      {selectedBatch && (
        <BatchInfoPanel
          key={selectedBatch.id}
          batch={selectedBatch}
          onClose={() => setSelectedBatch(null)}
          onGerminate={(b) => setGerminateBatch(b)}
          onSelectBatch={(b) => setSelectedBatch(b)}
        />
      )}

      {selectedPlant && (
        <div style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          background: 'white',
          padding: 16,
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          minWidth: 220,
        }}>
          <strong>Растение #{selectedPlant.number}</strong>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {selectedPlant.species} {selectedPlant.variety}
          </div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            Статус: {PLANT_STATUS_LABELS[selectedPlant.status] ?? selectedPlant.status}
          </div>
          <button
            className="btn btn-ghost"
            style={{ marginTop: 8 }}
            onClick={() => setSelectedPlant(null)}
          >
            Закрыть
          </button>
        </div>
      )}

      {isCreateContainerOpen && (
        <ContainerCreateModal onClose={() => setCreateContainerOpen(false)} />
      )}

      {isCreateBatchOpen && (
        <BatchCreateModal onClose={() => setCreateBatchOpen(false)} />
      )}

      {germinateBatch && (
        <GerminateModal
          batch={germinateBatch}
          alreadyGerminated={
            plants.filter((p) => p.batch_id === germinateBatch.id).length
          }
          onClose={() => setGerminateBatch(null)}
        />
      )}
    </div>
  );
}

export default App;