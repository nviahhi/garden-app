import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { GardenCanvas } from './components/GardenCanvas';
import { ContainerList } from './components/ContainerList';
import { BatchList } from './components/BatchList';
import { ContainerEditPanel } from './components/ContainerEditPanel';
import { ContainerCreateModal } from './components/ContainerCreateModal';
import { BatchCreateModal } from './components/BatchCreateModal';
import { BatchInfoPanel } from './components/BatchInfoPanel';
import { PlantInfoPanel } from './components/PlantInfoPanel';
import { GerminateModal } from './components/GerminateModal';
import { TransplantModal } from './components/TransplantModal';
import { useContainerStore } from './store/useContainerStore';
import { useBatchStore } from './store/useBatchStore';
import type { Plant, Batch } from './types';

type SidebarTab = 'containers' | 'batches';

function App() {
  const containers = useContainerStore((s) => s.containers);
  const loadBatches = useBatchStore((s) => s.loadBatches);
  const loadPlants = useBatchStore((s) => s.loadPlants);
  const loadPlantWithEvents = useBatchStore((s) => s.loadPlantWithEvents);
  const plants = useBatchStore((s) => s.plants);

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('containers');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [germinateBatch, setGerminateBatch] = useState<Batch | null>(null);
  const [transplantPlant, setTransplantPlant] = useState<Plant | null>(null);

  const [isCreateContainerOpen, setCreateContainerOpen] = useState(false);
  const [isCreateBatchOpen, setCreateBatchOpen] = useState(false);

  const selectedContainer = containers.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    loadBatches();
    loadPlants();
  }, [loadBatches, loadPlants]);

  // Подгружаем события выбранного растения
  useEffect(() => {
    if (selectedPlant) {
      loadPlantWithEvents(selectedPlant.id);
    }
  }, [selectedPlant, loadPlantWithEvents]);

  const highlightedContainerIds = useMemo(() => {
    if (!selectedBatch) return new Set<number>();
    const ids = new Set<number>();
    if (selectedBatch.container_id != null) {
      ids.add(selectedBatch.container_id);
    } else {
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
    setSelectedId(null);
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

      {selectedBatch && !selectedPlant && (
        <BatchInfoPanel
          key={selectedBatch.id}
          batch={selectedBatch}
          onClose={() => setSelectedBatch(null)}
          onGerminate={(b) => setGerminateBatch(b)}
          onSelectBatch={(b) => setSelectedBatch(b)}
        />
      )}

      {selectedPlant && (
        <PlantInfoPanel
          key={selectedPlant.id}
          plant={selectedPlant}
          onClose={() => setSelectedPlant(null)}
          onTransplant={(p) => setTransplantPlant(p)}
        />
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

      {transplantPlant && (
        <TransplantModal
          plant={transplantPlant}
          onClose={() => setTransplantPlant(null)}
        />
      )}
    </div>
  );
}

export default App;