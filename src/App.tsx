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
import { ZoneSwitcher } from './components/ZoneSwitcher';
import { ZoneModal } from './components/ZoneModal';
import { PlantSearch } from './components/PlantSearch';
import { useContainerStore } from './store/useContainerStore';
import { useBatchStore } from './store/useBatchStore';
import { useZoneStore } from './store/useZoneStore';
import type { Plant, Batch } from './types';

type SidebarTab = 'containers' | 'batches';
type ZoneModalState = { mode: 'create' } | { mode: 'edit'; zoneId: number } | null;

function App() {
  const containers = useContainerStore((s) => s.containers);
  const loadContainers = useContainerStore((s) => s.loadContainers);

  const loadBatches = useBatchStore((s) => s.loadBatches);
  const loadPlants = useBatchStore((s) => s.loadPlants);
  const loadPlantWithEvents = useBatchStore((s) => s.loadPlantWithEvents);
  const plants = useBatchStore((s) => s.plants);
  const batches = useBatchStore((s) => s.batches);

  const currentZone = useZoneStore((s) => s.currentZone);
  const loadZones = useZoneStore((s) => s.loadZones);
  const selectZone = useZoneStore((s) => s.selectZone);

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('containers');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [germinateBatch, setGerminateBatch] = useState<Batch | null>(null);
  const [transplantPlant, setTransplantPlant] = useState<Plant | null>(null);

  const [isCreateContainerOpen, setCreateContainerOpen] = useState(false);
  const [isCreateBatchOpen, setCreateBatchOpen] = useState(false);
  const [zoneModal, setZoneModal] = useState<ZoneModalState>(null);
  const [isSearchOpen, setSearchOpen] = useState(false);

  // Загружаем зоны при монтировании
  useEffect(() => {
    loadZones();
  }, [loadZones]);

  // Загружаем данные после выбора зоны
  useEffect(() => {
    loadContainers();
    loadBatches();
    loadPlants();
  }, [loadContainers, loadBatches, loadPlants]);

  // Подгружаем события выбранного растения
  useEffect(() => {
    if (selectedPlant) {
      loadPlantWithEvents(selectedPlant.id);
    }
  }, [selectedPlant, loadPlantWithEvents]);

  // Cmd+K / Ctrl+K — открыть поиск
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Контейнеры текущей зоны
  const zoneContainers = useMemo(
    () => containers.filter((c) => c.zone_id === currentZone?.id),
    [containers, currentZone]
  );

  const selectedContainer = zoneContainers.find((c) => c.id === selectedId) ?? null;

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

  // Контейнер выбранного растения — если у него нет маркера (партия бейджем),
  // подсвечиваем контейнер, чтобы пользователь видел, где растение.
  const selectedPlantHighlightIds = useMemo(() => {
    const ids = new Set<number>();
    if (!selectedPlant) return ids;
    if (selectedPlant.container_id == null) return ids;

    const container = containers.find((c) => c.id === selectedPlant.container_id);
    if (!container) return ids;

    const batch = batches.find((b) => b.id === selectedPlant.batch_id);
    if (!batch) return ids;

    // ===== Проверяем, будет ли у растения МАРКЕР в ContainerPlants =====
    // Логика из ContainerPlants: маркер есть, если
    // 1. cell_index !== null, ИЛИ
    // 2. контейнер — горшок, ИЛИ
    // 3. партия распределена по горшкам (container_id === null), ИЛИ
    // 4. партия в другом контейнере (гость), ИЛИ
    // 5. партия в этом контейнере, но есть растения с cell_index (маркеры в ячейках)

    // 1. Есть ячейка — точно маркер
    if (selectedPlant.cell_index !== null) return ids;

    // 2. Горшок — точно маркер
    if (container.type === 'pot') return ids;

    // 3. Распределённая партия — точно маркер
    if (batch.container_id === null) return ids;

    // 4. Гость — партия из другого контейнера, у неё здесь маркер
    if (batch.container_id !== container.id) return ids;

    // 5. Партия в этом контейнере — маркер есть, если есть растения по ячейкам
    const hasCellPlants = plants.some(
      (p) =>
        p.batch_id === batch.id &&
        p.container_id === container.id &&
        p.cell_index !== null
    );
    if (hasCellPlants) return ids;

    // ===== Маркера нет — партия показана бейджем, подсвечиваем контейнер =====
    ids.add(container.id);
    return ids;
  }, [selectedPlant, containers, batches, plants]);

  // Объединённая подсветка
  const effectiveHighlightedContainerIds = useMemo(() => {
    if (selectedPlantHighlightIds.size === 0) return highlightedContainerIds;
    const merged = new Set(highlightedContainerIds);
    for (const id of selectedPlantHighlightIds) merged.add(id);
    return merged;
  }, [highlightedContainerIds, selectedPlantHighlightIds]);

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

  const handleZoneSwitch = () => {
    // Сбрасываем всё выбранное при переключении зоны
    setSelectedId(null);
    setSelectedBatch(null);
    setSelectedPlant(null);
  };

  return (
    <div className="app-layout">
      {sidebarTab === 'containers' ? (
        <ContainerList
          selectedId={selectedId}
          zoneId={currentZone?.id ?? null}
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
        <ZoneSwitcher
          onSwitch={handleZoneSwitch}
          onCreate={() => setZoneModal({ mode: 'create' })}
          onEdit={() => currentZone && setZoneModal({ mode: 'edit', zoneId: currentZone.id })}
        />

        <div className="canvas-toolbar">
          <button
            className="btn btn-primary"
            onClick={() => setCreateBatchOpen(true)}
          >
            + Новая партия
          </button>

          <button
            className="btn btn-ghost"
            onClick={() => setSearchOpen(true)}
            title="Поиск растений (Cmd/Ctrl+K)"
          >
            🔍 Поиск
          </button>

        </div>
        <GardenCanvas
          selectedId={selectedId}
          selectedPlantId={selectedPlant?.id ?? null}
          onSelect={handleContainerSelect}
          onPlantClick={handlePlantClick}
          onBatchClick={handleBatchClick}
          highlightedContainerIds={effectiveHighlightedContainerIds}
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
          onTransplant={(p) => setTransplantPlant(p)}
        />
      )}

      {selectedPlant && (
        <PlantInfoPanel
          key={selectedPlant.id}
          plant={selectedPlant}
          onClose={() => setSelectedPlant(null)}
          onTransplant={(p) => setTransplantPlant(p)}
          onBatchClick={(b) => {
            setSelectedBatch(b);
            setSelectedPlant(null);
          }}
        />
      )}

      {isCreateContainerOpen && currentZone && (
        <ContainerCreateModal
          zoneId={currentZone.id}
          onClose={() => setCreateContainerOpen(false)}
        />
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

      {isSearchOpen && (
        <PlantSearch
          onClose={() => setSearchOpen(false)}
          onSelect={async (p, zoneId) => {
            setSearchOpen(false);

            // Переключаемся на нужную зону, если она отличается от текущей
            if (zoneId != null && zoneId !== currentZone?.id) {
              await selectZone(zoneId);
            }

            handlePlantClick(p);
          }}
        />
      )}

      {zoneModal && (
        <ZoneModal
          mode={zoneModal.mode}
          zoneId={zoneModal.mode === 'edit' ? zoneModal.zoneId : undefined}
          onClose={() => setZoneModal(null)}
        />
      )}
    </div>
  );
}

export default App;