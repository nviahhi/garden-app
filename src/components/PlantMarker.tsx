import { Circle, Text, Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Plant } from '../types';

const STATUS_COLORS: Record<Plant['status'], string> = {
  seedling: '#a5d6a7',
  growing: '#4caf50',
  transplanted: '#ffb74d',
  harvested: '#64b5f6',
  dead: '#e57373',
};

interface PlantMarkerProps {
  plant: Plant;
  x: number;
  y: number;
  radius?: number;
  onClick?: () => void;
}

export function PlantMarker({ plant, x, y, radius = 8, onClick }: PlantMarkerProps) {
  const handleClick = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    onClick?.();
  };

  return (
    <Group x={x} y={y} onClick={handleClick} onTap={handleClick}>
      <Circle
        radius={radius}
        fill={STATUS_COLORS[plant.status]}
        stroke="#2e4a2e"
        strokeWidth={1}
        shadowBlur={3}
        shadowColor="rgba(0,0,0,0.3)"
      />
      <Text
        text={String(plant.number)}
        fontSize={radius}
        fill="#1a2e1a"
        fontStyle="bold"
        width={radius * 2}
        height={radius * 2}
        offsetX={radius}
        offsetY={radius / 1.5}
        align="center"
        listening={false}
      />
    </Group>
  );
}