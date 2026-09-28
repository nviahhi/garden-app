import { Group, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Container, Plant, Batch } from '../types';
import { PlantMarker } from './PlantMarker';

const CELL_PADDING = 6;
const HEADER_HEIGHT = 44;
const BADGE_HEIGHT = 22;
const BADGE_GAP = 4;
const BADGE_PADDING = 8;

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

  // ===== Режим 1: сетка + растения с cell_index =====
  if (hasGrid && hasPlants) {
    const cols = container.cols!;
    const rows = container.rows!;

    const gridWidth = container.width - CELL_PADDING * 2;
    const gridHeight = container.height - HEADER_HEIGHT - CELL_PADDING;
    const cellWidth = gridWidth / cols;
    const cellHeight = gridHeight / rows;

    const plantsByCell = plants.filter((p) => p.cell_index !== null);

    if (plantsByCell.length > 0) {
      return (
        <Group>
          {plantsByCell.map((plant) => {
            const cellIndex = plant.cell_index!;
            const col = cellIndex % cols;
            const row = Math.floor(cellIndex / cols);
            if (row >= rows) return null;

            const cx = CELL_PADDING + col * cellWidth + cellWidth / 2;
            const cy = HEADER_HEIGHT + row * cellHeight + cellHeight / 2;
            const radius = Math.max(3, Math.min(cellWidth, cellHeight) / 2 - 9);

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
          })}
        </Group>
      );
    }
  }

  // ===== Режим 1.5: без сетки, 1–4 растения — маркеры в ряд + бейджи =====
  const nonGridPlants = plants.filter((p) => p.cell_index === null);

  if (!hasGrid && nonGridPlants.length > 0 && nonGridPlants.length <= 4) {
    const count = nonGridPlants.length;
    const RADIUS = 14;
    const GAP = RADIUS * 2 + 4;
    const startX = container.width / 2 - ((count - 1) * GAP) / 2;
    const cy = container.height / 2 + 6;

    const badgeItems = buildBadgeItems(plants, batches, onBatchClick);

    return (
      <Group>
        {/* Маркеры растений */}
        {nonGridPlants.map((plant, i) => (
          <PlantMarker
            key={plant.id}
            plant={plant}
            x={startX + i * GAP}
            y={cy}
            radius={RADIUS}
            onClick={() => onPlantClick?.(plant)}
          />
        ))}

        {/* Бейджи партий */}
        {renderBadges(container, badgeItems)}
      </Group>
    );
  }

  // ===== Режим 2: бейджи по партиям =====
  const items = buildBadgeItems(plants, batches, onBatchClick);

  if (items.length === 0) return null;

  return renderBadges(container, items);
}

// Общая логика формирования бейджей
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

    // Партия распределена по горшкам (container_id = null) — локальный счёт
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