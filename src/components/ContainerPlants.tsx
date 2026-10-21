import { Group, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Container, Plant, Batch } from '../types';
import { PlantMarker } from './PlantMarker';

const CELL_PADDING = 6;
const HEADER_HEIGHT = 44;
const BADGE_HEIGHT = 22;
const BADGE_GAP = 4;
const BADGE_PADDING = 8;

const MAX_RADIUS_GRID = 18;
const MAX_RADIUS_FREE = 24;

interface ContainerPlantsProps {
  container: Container;
  plants: Plant[];
  batches: Batch[];
  selectedPlantId?: number | null;
  onPlantClick?: (plant: Plant) => void;
  onBatchClick?: (batch: Batch) => void;
  onPlantDragEnd?: (plant: Plant, e: KonvaEventObject<DragEvent>) => void;
}

export function ContainerPlants({
  container,
  plants,
  batches,
  selectedPlantId,
  onPlantClick,
  onBatchClick,
  onPlantDragEnd,
}: ContainerPlantsProps) {
  const hasGrid =
    container.cols != null && container.rows != null &&
    container.cols > 0 && container.rows > 0;

  const hasPlants = plants.length > 0;
  const hasBatches = batches.length > 0;

  if (!hasPlants && !hasBatches) return null;

  // ===== Партии, для которых есть бейдж в этом контейнере =====
  const badgeBatchIds = new Set<number>();
  for (const batch of batches) {
    const batchPlants = plants.filter((p) => p.batch_id === batch.id);

    // 1. Растения по ячейкам кассеты — маркерами
    const hasCellPlants = batchPlants.some((p) => p.cell_index !== null);
    if (hasCellPlants) continue;

    // 2. Партия в горшке — всегда маркерами
    if (container.type === 'pot') continue;

    // 3. Партия распределена по разным горшкам — маркерами
    if (batch.container_id === null) continue;

    // 4. Партия «переехала» целиком — в этом контейнере её растений нет
    const totalPlants = batch.plants_count ?? 0;
    if (totalPlants > 0 && batchPlants.length === 0) continue;

    // 5. Россыпь в кассете / грядке — бейджем
    badgeBatchIds.add(batch.id);
  }

  // ===== Растения, которые рисуем маркерами =====
  const markerPlants = plants.filter((p) => {
    if (p.cell_index !== null) return true;
    return !badgeBatchIds.has(p.batch_id);
  });

  // ===== Режим 1: кассета с сеткой =====
  if (hasGrid) {
    const cols = container.cols!;
    const rows = container.rows!;
    const totalCells = cols * rows;

    const gridWidth = container.width - CELL_PADDING * 2;
    const gridHeight = container.height - HEADER_HEIGHT - CELL_PADDING;
    const cellWidth = gridWidth / cols;
    const cellHeight = gridHeight / rows;
    const radius = Math.max(
      3,
      Math.min(MAX_RADIUS_GRID, Math.min(cellWidth, cellHeight) / 2 - 9)
    );

    const plantsByCell = markerPlants.filter((p) => p.cell_index !== null);
    const plantsWithoutCell = markerPlants.filter((p) => p.cell_index === null);

    const occupied = new Set(
      plantsByCell.map((p) => p.cell_index!).filter((i) => i < totalCells)
    );

    const freeCells: number[] = [];
    for (let i = 0; i < totalCells && freeCells.length < plantsWithoutCell.length; i++) {
      if (!occupied.has(i)) freeCells.push(i);
    }

    const renderAt = (plant: Plant, cellIndex: number) => {
      const col = cellIndex % cols;
      const row = Math.floor(cellIndex / cols);
      const cx = CELL_PADDING + col * cellWidth + cellWidth / 2;
      const cy = HEADER_HEIGHT + row * cellHeight + cellHeight / 2;

      return (
        <PlantMarker
          key={plant.id}
          plant={plant}
          x={cx}
          y={cy}
          radius={radius}
          isSelected={plant.id === selectedPlantId}
          onClick={() => onPlantClick?.(plant)}
          onDragEnd={
            onPlantDragEnd
              ? (e) => onPlantDragEnd(plant, e)
              : undefined
          }
        />
      );
    };

    const badgeItems = buildBadgeItems(
      plants,
      batches.filter((b) => badgeBatchIds.has(b.id)),
      onBatchClick
    );

    return (
      <Group>
        {plantsByCell.map((p) =>
          p.cell_index! < totalCells ? renderAt(p, p.cell_index!) : null
        )}

        {plantsWithoutCell.map((p, i) =>
          i < freeCells.length ? renderAt(p, freeCells[i]) : null
        )}

        {badgeItems.length > 0 && renderBadges(container, badgeItems)}
      </Group>
    );
  }

  // ===== Режим 2: без сетки =====
  const badgeItems = buildBadgeItems(
    plants,
    batches.filter((b) => badgeBatchIds.has(b.id)),
    onBatchClick
  );

  const markerCount = markerPlants.length;
  const cols = Math.min(6, Math.max(1, markerCount));
  const rows = Math.ceil(markerCount / cols) || 1;

  const topOffset = container.height < 80 ? 22 : HEADER_HEIGHT;
  const gridWidth = container.width - CELL_PADDING * 2;
  const gridHeight =
    container.height < 80
      ? container.height - topOffset
      : container.height - HEADER_HEIGHT - CELL_PADDING;
  const cellW = gridWidth / cols;
  const cellH = gridHeight / rows;
  const maxR = container.height < 80 ? 10 : MAX_RADIUS_FREE;
  const radius = Math.max(4, Math.min(maxR, Math.min(cellW, cellH) / 2 - 1));

  return (
    <Group>
      {markerPlants.map((plant, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = CELL_PADDING + col * cellW + cellW / 2;
        const cy = topOffset + row * cellH + cellH / 2;

        return (
          <PlantMarker
            key={plant.id}
            plant={plant}
            x={cx}
            y={cy}
            radius={radius}
            isSelected={plant.id === selectedPlantId}
            onClick={() => onPlantClick?.(plant)}
            onDragEnd={
              onPlantDragEnd
                ? (e) => onPlantDragEnd(plant, e)
                : undefined
            }
          />
        );
      })}

      {badgeItems.length > 0 && renderBadges(container, badgeItems)}
    </Group>
  );
}

function buildBadgeItems(
  plants: Plant[],
  batches: Batch[],
  onBatchClick?: (batch: Batch) => void
) {
  return batches.map((batch) => {
    const localPlants = plants.filter((p) => p.batch_id === batch.id);

    if (localPlants.length === 0) {
      return {
        batch,
        label: `🌰 0/${batch.seeds_count}`,
        color: '#e0e0e0',
        onClick: () => onBatchClick?.(batch),
      };
    }

    const isDistributed = batch.container_id === null;
    const total = isDistributed ? localPlants.length : batch.seeds_count;
    const germinated = localPlants.filter((p) => p.status !== 'sown').length;

    const label = germinated > 0
      ? `🌱 ${germinated}/${total}`
      : `🌰 0/${total}`;

    return {
      batch,
      label,
      color: germinated > 0 ? '#d4e8d4' : '#e0e0e0',
      onClick: () => onBatchClick?.(batch),
    };
  });
}

interface BadgeItem {
  batch: Batch;
  label: string;
  color: string;
  onClick: () => void;
}

function renderBadges(container: Container, items: BadgeItem[]) {
  return (
    <Group>
      {items.map((item, index) => {
        const fromBottom = items.length - 1 - index;
        const y =
          container.height -
          BADGE_PADDING -
          BADGE_HEIGHT -
          fromBottom * (BADGE_HEIGHT + BADGE_GAP);

        return (
          <Badge
            key={item.batch.id}
            containerWidth={container.width}
            y={y}
            label={item.label}
            color={item.color}
            onClick={item.onClick}
          />
        );
      })}
    </Group>
  );
}

interface BadgeProps {
  containerWidth: number;
  y: number;
  label: string;
  color: string;
  onClick: () => void;
}

function Badge({ containerWidth, y, label, color, onClick }: BadgeProps) {
  const visualLength = label.length + 1;
  const badgeWidth = Math.max(46, visualLength * 7 + 14);
  const x = containerWidth - badgeWidth - BADGE_PADDING;

  const handleClick = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    onClick();
  };

  const handleMouseEnter = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = 'pointer';
  };

  const handleMouseLeave = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = 'default';
  };

  return (
    <Group
      onClick={handleClick}
      onTap={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Rect
        x={x}
        y={y}
        width={badgeWidth}
        height={BADGE_HEIGHT}
        fill={color}
        cornerRadius={BADGE_HEIGHT / 2}
        shadowBlur={2}
        shadowColor="rgba(0,0,0,0.15)"
      />
      <Text
        x={x}
        y={y + 5}
        width={badgeWidth}
        text={label}
        fontSize={12}
        fill="#2e4a2e"
        fontStyle="bold"
        align="center"
        listening={false}
      />
    </Group>
  );
}