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
import { StatsDashboard } from './components/StatsDashboard';
import { WelcomeScreen } from './components/WelcomeScreen';
import { GuestBanner } from './components/GuestBanner';
import { UserBar } from './components/UserBar';
import { demoApi } from './api/demo';
import { exportApi } from './api/export';
import { exportPlantsToPdf } from './utils/pdfExport';
import { useContainerStore } from './store/useContainerStore';
import { useBatchStore } from './store/useBatchStore';
import { useZoneStore } from './store/useZoneStore';
import { useAuthStore } from './store/useAuthStore';
import type { Plant, Batch } from './types';

type SidebarTab = 'containers' | 'batches';
type ZoneModalState = { mode: 'create' } | { mode: 'edit'; zoneId: number } | null;

const WELCOME_SEEN_KEY = 'garden-welcome-seen';

function App() {
  // ===== Auth =====
  const { user, isLoading: authLoading, init } = useAuthStore();

  // ===== Данные =====
  const containers = useContainerStore((s) => s.containers);
  const loadContainers = useContainerStore((s) => s.loadContainers);

  const loadBatches = useBatchStore((s) => s.loadBatches);
  const loadPlants = useBatchStore((s) => s.loadPlants);
  const loadPlantWithEvents = useBatchStore((s) => s.loadPlantWithEvents);
  const plants = useBatchStore((s) => s.plants);
  const batches = useBatchStore((s) => s.batches);

  const currentZone = useZoneStore((s) => s.currentZone);
  const zones = useZoneStore((s) => s.zones);
  const loadZones = useZoneStore((s) => s.loadZones);
  const selectZone = useZoneStore((s) => s.selectZone);

  // ===== UI state =====
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('containers');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [germinateBatch, setGerminateBatch] = useState<Batch | null>(null);
  const [transplantPlant, setTransplantPlant] = useState<Plant | null>(null);
  const [isCreateContainerOpen, setCreateContainerOpen] = useState(false);
  const [isCreateBatchOpen, setCreateBatchOpen] = useState(false);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isStatsOpen, setStatsOpen] = useState(false);
  const [zoneModal, setZoneModal] = useState<ZoneModalState>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [resettingDemo, setResettingDemo] = useState(false);
  const [welcomeSeen, setWelcomeSeen] = useState(
    localStorage.getItem(WELCOME_SEEN_KEY) === 'true'
  );

  // ===== Auth init (создаст гостя, если нужно) =====
  useEffect(() => {
    init();
  }, [init]);

  // ===== Загрузка данных после auth =====
  useEffect(() => {
    if (!user) return;
    loadZones();
    loadContainers();
    loadBatches();
    loadPlants();
  }, [user, loadZones, loadContainers, loadBatches, loadPlants]);

  // ===== История выбранного растения =====
  useEffect(() => {
    if (selectedPlant) {
      loadPlantWithEvents(selectedPlant.id);
    }
  }, [selectedPlant, loadPlantWithEvents]);

  // ===== Cmd+K / Ctrl+K — открыть поиск =====
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

  // ===== Derived =====
  const zoneContainers = useMemo(
    () => containers.filter((c) => c.zone_id === currentZone?.id),
    [containers, currentZone]
  );

  const selectedContainer =
    zoneContainers.find((c) => c.id === selectedId) ?? null;

  // Подсветка контейнеров по выбранной партии
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

  // Подсветка контейнера, если у выбранного растения нет маркера
  const selectedPlantHighlightIds = useMemo(() => {
    const ids = new Set<number>();
    if (!selectedPlant) return ids;
    if (selectedPlant.container_id == null) return ids;

    const container = containers.find(
      (c) => c.id === selectedPlant.container_id
    );
    if (!container) return ids;

    const batch = batches.find((b) => b.id === selectedPlant.batch_id);
    if (!batch) return ids;

    if (selectedPlant.cell_index !== null) return ids;
    if (container.type === 'pot') return ids;
    if (batch.container_id === null) return ids;
    if (batch.container_id !== container.id) return ids;

    const hasCellPlants = plants.some(
      (p) =>
        p.batch_id === batch.id &&
        p.container_id === container.id &&
        p.cell_index !== null
    );
    if (hasCellPlants) return ids;

    ids.add(container.id);
    return ids;
  }, [selectedPlant, containers, batches, plants]);

  const effectiveHighlightedContainerIds = useMemo(() => {
    if (selectedPlantHighlightIds.size === 0) return highlightedContainerIds;
    const merged = new Set(highlightedContainerIds);
    for (const id of selectedPlantHighlightIds) merged.add(id);
    return merged;
  }, [highlightedContainerIds, selectedPlantHighlightIds]);

  const hasDemo = zones.some((z) => z.is_demo);

  // ===== Handlers =====
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
    setSelectedId(null);
    setSelectedBatch(null);
    setSelectedPlant(null);
  };

  const handleExportAll = async () => {
    setExportingAll(true);
    try {
      const allPlants = await exportApi.plantsAll();
      await exportPlantsToPdf({
        title: 'Журнал рассады',
        subtitle: 'Полный экспорт всех растений',
        plants: allPlants,
        zones,
        containers,
        filename: `garden-export-${new Date().toISOString().slice(0, 10)}.pdf`,
      });
    } catch (err) {
      console.error(err);
      alert('Не удалось сформировать PDF');
    } finally {
      setExportingAll(false);
    }
  };

  const handleResetDemo = async () => {
    if (
      !confirm(
        'Удалить демо-данные? Все демо-зоны и растения будут удалены.'
      )
    ) {
      return;
    }
    setResettingDemo(true);
    try {
      await demoApi.reset();
      await loadZones();
      await loadContainers();
      await loadBatches();
      await loadPlants();
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить демо-данные');
    } finally {
      setResettingDemo(false);
    }
  };

  const dismissWelcome = () => {
    localStorage.setItem(WELCOME_SEEN_KEY, 'true');
    setWelcomeSeen(true);
  };

  const handleStartFromScratch = () => {
    dismissWelcome();
    setZoneModal({ mode: 'create' });
  };

  const handleStartWithDemo = async () => {
    try {
      await demoApi.seed();
      await loadZones();
      await loadContainers();
      await loadBatches();
      await loadPlants();
      dismissWelcome();
    } catch (err) {
      console.error(err);
      alert('Не удалось загрузить демо-данные');
    }
  };

  // ===== Loading =====
  if (authLoading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
        <p>Загрузка...</p>
      </div>
    );
  }

  // Welcome показываем, если:
  //  - сессии ещё нет (гость создаётся по клику на кнопку),
  //  ИЛИ
  //  - сессия есть, но welcome не пройден и данных нет
  if (!user || (!welcomeSeen && zones.length === 0)) {
    return (
      <WelcomeScreen
        onStart={handleStartFromScratch}
        onDemo={handleStartWithDemo}
      />
    );
  }

  // ===== Приложение =====
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
        <UserBar />
        <GuestBanner />

        <ZoneSwitcher
          onSwitch={handleZoneSwitch}
          onCreate={() => setZoneModal({ mode: 'create' })}
          onEdit={() =>
            currentZone &&
            setZoneModal({ mode: 'edit', zoneId: currentZone.id })
          }
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
          <button
            className="btn btn-ghost"
            onClick={handleExportAll}
            disabled={exportingAll}
            title="Экспорт всех растений в PDF"
          >
            {exportingAll ? '⏳ Формирую PDF...' : '📄 Экспорт'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setStatsOpen(true)}
            title="Статистика"
          >
            📊 Статистика
          </button>
          {hasDemo && (
            <button
              className="btn btn-ghost"
              onClick={handleResetDemo}
              disabled={resettingDemo}
              title="Удалить демо-данные"
            >
              {resettingDemo ? '⏳ Удаляю...' : '🔄 Сбросить демо'}
            </button>
          )}
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
            if (zoneId != null && zoneId !== currentZone?.id) {
              await selectZone(zoneId);
            }
            handlePlantClick(p);
          }}
        />
      )}

      {isStatsOpen && (
        <StatsDashboard onClose={() => setStatsOpen(false)} />
      )}

      {zoneModal && (
        <ZoneModal
          mode={zoneModal.mode}
          zoneId={zoneModal.mode === 'edit' ? zoneModal.zoneId : undefined}
          onClose={() => {
            setZoneModal(null);
            loadZones();
          }}
        />
      )}
    </div>
  );
}

export default App;