import { Stage, Layer, Rect, Text, Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useContainerStore } from '../store/useContainerStore';
import { useBatchStore } from '../store/useBatchStore';
import { useZoneStore } from '../store/useZoneStore';
import type { Container, Plant, Batch, Zone } from '../types';
import { CanvasGrid } from './CanvasGrid';
import { ContainerCells } from './ContainerCells';
import { ContainerPlants } from './ContainerPlants';
import { ZoneBackground } from './ZoneBackground';

const GRID_SIZE = 20;

interface GardenCanvasProps {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onPlantClick?: (plant: Plant) => void;
  onBatchClick?: (batch: Batch) => void;
  highlightedContainerIds?: Set<number>;
}

function ContainerShape({
  container,
  plants,
  batches,
  isSelected,
  isHighlighted,
  onSelect,
  onPlantClick,
  onBatchClick,
  onHoverChange,
}: {
  container: Container;
  plants: Plant[];
  batches: Batch[];
  isSelected: boolean;
  isHighlighted: boolean;
  onSelect: () => void;
  onPlantClick?: (plant: Plant) => void;
  onBatchClick?: (batch: Batch) => void;
  onHoverChange: (hovered: boolean) => void;
}) {
  const updateContainer = useContainerStore((s) => s.updateContainer);

  const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    const x = snapToGrid(e.target.x());
    const y = snapToGrid(e.target.y());
    e.target.position({ x, y });
    updateContainer(container.id, { x, y });
  };

  const hasCells =
    container.cols != null && container.rows != null &&
    container.cols > 0 && container.rows > 0;

  return (
    <Group
      x={container.x}
      y={container.y}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <Rect
        width={container.width}
        height={container.height}
        fill="#e8f5e9"
        stroke={isSelected || isHighlighted ? '#2e7d32' : '#4a7c4a'}
        strokeWidth={isSelected || isHighlighted ? 3 : 2}
        cornerRadius={6}
        shadowBlur={isHighlighted ? 14 : 5}
        shadowColor={isHighlighted ? '#4caf50' : 'rgba(0,0,0,0.2)'}
      />

      {hasCells && (
        <ContainerCells
          width={container.width}
          height={container.height}
          cols={container.cols!}
          rows={container.rows!}
        />
      )}

      <Text
        x={8}
        y={8}
        width={container.width - 16}
        text={container.name}
        fontSize={13}
        fill="#2e4a2e"
        fontStyle="bold"
        wrap="word"
        ellipsis
      />
      <Text
        x={8}
        y={36}
        width={container.width - 16}
        text={container.type}
        fontSize={11}
        fill="#6b8e6b"
        wrap="word"
        ellipsis
      />

      <ContainerPlants
        container={container}
        plants={plants}
        batches={batches}
        onPlantClick={onPlantClick}
        onBatchClick={onBatchClick}
      />
    </Group>
  );
}

export function GardenCanvas({
  selectedId,
  onSelect,
  onPlantClick,
  onBatchClick,
  highlightedContainerIds,
}: GardenCanvasProps) {
  const { containers, isLoading, loadContainers } = useContainerStore();
  const zone = useZoneStore((s) => s.currentZone);
  const plants = useBatchStore((s) => s.plants);
  const batches = useBatchStore((s) => s.batches);
  const loadPlants = useBatchStore((s) => s.loadPlants);
  const loadBatches = useBatchStore((s) => s.loadBatches);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [isOverContainer, setOverContainer] = useState(false);
  const [isPanning, setPanning] = useState(false);

  const scale = fitScale * zoom;

  useEffect(() => {
    loadContainers();
    loadPlants();
    loadBatches();
  }, [loadContainers, loadPlants, loadBatches]);

  // ===== Автоматическая подгонка под размер контейнера =====
  useEffect(() => {
    if (!zone || !containerRef.current) return;

    const el = containerRef.current;

    const updateFitScale = () => {
      const availableWidth = el.clientWidth;
      const availableHeight = el.clientHeight;

      const padding = 32;
      const maxW = availableWidth - padding;
      const maxH = availableHeight - padding;

      const scaleX = maxW / zone.canvas_width;
      const scaleY = maxH / zone.canvas_height;

      const newScale = Math.min(1, scaleX, scaleY);
      setFitScale(newScale);
    };

    updateFitScale();

    const observer = new ResizeObserver(updateFitScale);
    observer.observe(el);

    return () => observer.disconnect();
  }, [zone]);

  // ===== Сброс вида при смене зоны =====
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZoom(1);
    if (stageRef.current) {
      stageRef.current.position({ x: 0, y: 0 });
    }
  }, [zone?.id]);

  // ===== Курсор =====
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const container = stage.container();

    if (isPanning) {
      container.style.cursor = 'grabbing';
    } else if (isOverContainer) {
      container.style.cursor = 'move';
    } else {
      container.style.cursor = 'grab';
    }
  }, [isOverContainer, isPanning]);

  // ===== Zoom колесом мыши =====
  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const zoomStep = 0.1;

    let newZoom = direction > 0 ? zoom + zoomStep : zoom - zoomStep;
    newZoom = Math.max(0.3, Math.min(3, +newZoom.toFixed(2)));

    if (newZoom === zoom) return;

    const newScale = fitScale * newZoom;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    stage.position(newPos);
    setZoom(newZoom);
  };

  const handleZoomIn = () => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)));
  const handleZoomFit = () => {
    setZoom(1);
    if (stageRef.current) {
      stageRef.current.position({ x: 0, y: 0 });
    }
  };

  const zoneContainers = useMemo(
    () => containers.filter((c) => c.zone_id === zone?.id),
    [containers, zone]
  );

  const plantsByContainer = useMemo(() => {
    const map = new Map<number, Plant[]>();
    for (const plant of plants) {
      if (plant.container_id == null) continue;
      const list = map.get(plant.container_id) ?? [];
      list.push(plant);
      map.set(plant.container_id, list);
    }
    return map;
  }, [plants]);

  const batchesByContainer = useMemo(() => {
    const map = new Map<number, Batch[]>();

    for (const batch of batches) {
      if (batch.container_id != null) {
        const list = map.get(batch.container_id) ?? [];
        list.push(batch);
        map.set(batch.container_id, list);
      }
    }

    for (const batch of batches) {
      if (batch.container_id != null) continue;

      const containerIds = new Set(
        plants
          .filter((p) => p.batch_id === batch.id && p.container_id != null)
          .map((p) => p.container_id!)
      );

      for (const cid of containerIds) {
        const list = map.get(cid) ?? [];
        if (!list.find((b) => b.id === batch.id)) list.push(batch);
        map.set(cid, list);
      }
    }

    return map;
  }, [batches, plants]);

  const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) {
      onSelect(null);
    }
  };

  const handleStageDblClick = () => {
    if (stageRef.current) {
      stageRef.current.position({ x: 0, y: 0 });
    }
  };

  const handleStageDragStart = () => setPanning(true);
  const handleStageDragEnd = () => setPanning(false);

  if (isLoading) return <div>Загрузка...</div>;

  if (!zone) {
    return (
      <div className="canvas-empty">
        <p>Нет выбранной зоны. Создайте зону, чтобы начать.</p>
      </div>
    );
  }

  const activeZone: Zone = zone;

  return (
    <div className="canvas-wrapper">
      <div className="canvas-zoom">
        <button
          className="zoom-btn"
          onClick={handleZoomOut}
          title="Уменьшить"
          disabled={zoom <= 0.3}
        >
          −
        </button>
        <button
          className="zoom-btn zoom-btn-fit"
          onClick={handleZoomFit}
          title="По размеру экрана"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          className="zoom-btn"
          onClick={handleZoomIn}
          title="Увеличить"
          disabled={zoom >= 3}
        >
          +
        </button>
      </div>

      <div ref={containerRef} className="canvas-container">
        <Stage
          ref={stageRef}
          width={activeZone.canvas_width * scale}
          height={activeZone.canvas_height * scale}
          scaleX={scale}
          scaleY={scale}
          draggable={!isOverContainer}
          onClick={handleStageClick}
          onDblClick={handleStageDblClick}
          onDragStart={handleStageDragStart}
          onDragEnd={handleStageDragEnd}
          onWheel={handleWheel}
        >
          <Layer listening={false}>
            <ZoneBackground zone={activeZone} />
          </Layer>

          <Layer listening={false}>
            <CanvasGrid
              width={activeZone.canvas_width}
              height={activeZone.canvas_height}
              cellSize={activeZone.grid_size}
            />
          </Layer>

          <Layer>
            {zoneContainers.map((container) => (
              <ContainerShape
                key={container.id}
                container={container}
                plants={plantsByContainer.get(container.id) ?? []}
                batches={batchesByContainer.get(container.id) ?? []}
                isSelected={selectedId === container.id}
                isHighlighted={highlightedContainerIds?.has(container.id) ?? false}
                onSelect={() => onSelect(container.id)}
                onPlantClick={onPlantClick}
                onBatchClick={onBatchClick}
                onHoverChange={setOverContainer}
              />
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}