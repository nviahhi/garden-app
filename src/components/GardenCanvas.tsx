import { Stage, Layer, Rect, Text, Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useEffect, useMemo } from 'react';
import { useContainerStore } from '../store/useContainerStore';
import { useBatchStore } from '../store/useBatchStore';
import type { Container, Plant, Batch } from '../types';
import { CanvasGrid } from './CanvasGrid';
import { ContainerCells } from './ContainerCells';
import { ContainerPlants } from './ContainerPlants';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
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
}: {
  container: Container;
  plants: Plant[];
  batches: Batch[];
  isSelected: boolean;
  isHighlighted: boolean;
  onSelect: () => void;
  onPlantClick?: (plant: Plant) => void;
  onBatchClick?: (batch: Batch) => void;
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
  const plants = useBatchStore((s) => s.plants);
  const batches = useBatchStore((s) => s.batches);
  const loadPlants = useBatchStore((s) => s.loadPlants);
  const loadBatches = useBatchStore((s) => s.loadBatches);

  useEffect(() => {
    loadContainers();
    loadPlants();
    loadBatches();
  }, [loadContainers, loadPlants, loadBatches]);

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

    // 1. Партии с явным container_id (россыпь, ячейки)
    for (const batch of batches) {
      if (batch.container_id != null) {
        const list = map.get(batch.container_id) ?? [];
        list.push(batch);
        map.set(batch.container_id, list);
      }
    }

    // 2. Партии, распределённые по горшкам (container_id = null)
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

  if (isLoading) return <div>Загрузка...</div>;

  return (
    <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT} onClick={handleStageClick}>
      <CanvasGrid width={CANVAS_WIDTH} height={CANVAS_HEIGHT} cellSize={GRID_SIZE} />
      <Layer>
        {containers.map((container) => (
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
          />
        ))}
      </Layer>
    </Stage>
  );
}