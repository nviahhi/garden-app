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

  // === Режим 1: сетка + растения с cell_index ===
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
            const radius = Math.max(6, Math.min(cellWidth, cellHeight) / 2 - 2);

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

  // === Режим 2: бейджи по партиям ===
  // Для каждой партии, у которой есть растения в ЭТОМ контейнере
  const items = batches.map((batch) => {
    const localPlants = plants.filter((p) => p.batch_id === batch.id);

    // Нет растений в этом контейнере — показываем как «посеяно»
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

    const germinated = localPlants.filter((p) =>
      p.status !== 'sown' && p.status !== 'dead'
    ).length;

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

  if (items.length === 0) return null;

  return renderBadges(container, items);
}

function renderBadges(
  container: Container,
  items: { batch: Batch; label: string; color: string; onClick: () => void }[]
) {
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