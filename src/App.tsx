import { useEffect, useState } from 'react';
import './App.css';
import { GardenCanvas } from './components/GardenCanvas';
import { ContainerList } from './components/ContainerList';
import { ContainerEditPanel } from './components/ContainerEditPanel';
import { ContainerCreateModal } from './components/ContainerCreateModal';
import { BatchCreateModal } from './components/BatchCreateModal';
import { BatchInfoPanel } from './components/BatchInfoPanel';
import { GerminateModal } from './components/GerminateModal';
import { useContainerStore } from './store/useContainerStore';
import { useBatchStore } from './store/useBatchStore';
import { PLANT_STATUS_LABELS, type Plant, type Batch } from './types';

function App() {
  const containers = useContainerStore((s) => s.containers);
  const loadBatches = useBatchStore((s) => s.loadBatches);
  const loadPlants = useBatchStore((s) => s.loadPlants);
  const plants = useBatchStore((s) => s.plants);

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
      <ContainerList
        selectedId={selectedId}
        onSelect={handleContainerSelect}
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
        <GardenCanvas
          selectedId={selectedId}
          onSelect={handleContainerSelect}
          onPlantClick={handlePlantClick}
          onBatchClick={handleBatchClick}
        />
      </main>

      {/* Панель редактирования контейнера */}
      {selectedContainer && !selectedBatch && !selectedPlant && (
        <ContainerEditPanel
          container={selectedContainer}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* Панель информации о партии */}
      {selectedBatch && (
        <BatchInfoPanel
          key={selectedBatch.id}
          batch={selectedBatch}
          onClose={() => setSelectedBatch(null)}
          onGerminate={(b) => setGerminateBatch(b)}
          onSelectBatch={(b) => setSelectedBatch(b)}
        />
      )}

      {/* Мини-карточка растения */}
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

      {/* Модалки */}
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