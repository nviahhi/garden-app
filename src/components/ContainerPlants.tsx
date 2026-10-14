import { Group, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Container, Plant, Batch } from '../types';
import { PlantMarker } from './PlantMarker';

const CELL_PADDING = 6;
const HEADER_HEIGHT = 44;
const BADGE_HEIGHT = 22;
const BADGE_GAP = 4;
const BADGE_PADDING = 8;

// Максимальные радиусы маркеров (в px)
const MAX_RADIUS_GRID = 10;   // кассета с сеткой
const MAX_RADIUS_FREE = 12;   // горшок / плошка без сетки

interface ContainerPlantsProps {
  container: Container;
  plants: Plant[];
  batches: Batch[];
  onPlantClick?: (plant: Plant) => void;
  onBatchClick?: (batch: Batch) => void;
}

export function ContainerPlants({
  container,
  plants,
  batches,
  onPlantClick,
  onBatchClick,
}: ContainerPlantsProps) {
  const hasGrid =
    container.cols != null && container.rows != null &&
    container.cols > 0 && container.rows > 0;

  const hasPlants = plants.length > 0;
  const hasBatches = batches.length > 0;

  if (!hasPlants && !hasBatches) return null;

  // ===== Какие партии показываем БЕЙДЖЕМ =====
  // Партия показывается бейджем, если у неё НЕТ растений с конкретной ячейкой.
  // Если растения по ячейкам — рисуем их маркерами на сетке.
  const badgeBatchIds = new Set<number>();
  for (const batch of batches) {
    const batchPlants = plants.filter((p) => p.batch_id === batch.id);
    const hasCellPlants = batchPlants.some((p) => p.cell_index !== null);
    if (!hasCellPlants) badgeBatchIds.add(batch.id);
  }

  // ===== Растения, которые рисуем маркерами =====
  // 1. Любое растение с cell_index != null (своё по ячейкам или гость)
  // 2. Гости (партии нет в badgeBatchIds) даже без ячейки
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

    // Растения с явной ячейкой
    const plantsByCell = markerPlants.filter((p) => p.cell_index !== null);
    // Растения без ячейки (гости)
    const plantsWithoutCell = markerPlants.filter((p) => p.cell_index === null);

    // Занятые ячейки
    const occupied = new Set(
      plantsByCell.map((p) => p.cell_index!).filter((i) => i < totalCells)
    );

    // Свободные ячейки для растений без cell_index
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
          onClick={() => onPlantClick?.(plant)}
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
        {/* Растения по ячейкам */}
        {plantsByCell.map((p) =>
          p.cell_index! < totalCells ? renderAt(p, p.cell_index!) : null
        )}

        {/* Растения без ячейки — в свободные */}
        {plantsWithoutCell.map((p, i) =>
          i < freeCells.length ? renderAt(p, freeCells[i]) : null
        )}

        {/* Бейджи россыпи */}
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

  return (
    <Group>
      {markerCount > 0 && (
        <Group>
          {(() => {
            const cols = Math.min(6, Math.max(1, markerCount));
            const rows = Math.ceil(markerCount / cols);

            const gridWidth = container.width - CELL_PADDING * 2;
            const gridHeight = container.height - HEADER_HEIGHT - CELL_PADDING;
            const cellW = gridWidth / cols;
            const cellH = gridHeight / rows;
            const radius = Math.max(
              5,
              Math.min(MAX_RADIUS_FREE, Math.min(cellW, cellH) / 2 - 4)
            );

            return markerPlants.map((plant, i) => {
              const col = i % cols;
              const row = Math.floor(i / cols);
              const cx = CELL_PADDING + col * cellW + cellW / 2;
              const cy = HEADER_HEIGHT + row * cellH + cellH / 2;

              return (
                <PlantMarker
                  key={plant.id}
                  plant={plant}
                  x={cx}
                  y={cy}
                  radius={radius}
                  onClick={() => onPlantClick?.(plant)}
                />
              );
            });
          })()}
        </Group>
      )}

      {badgeItems.length > 0 && renderBadges(container, badgeItems)}
    </Group>
  );
}

// Формирование бейджей по партиям
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