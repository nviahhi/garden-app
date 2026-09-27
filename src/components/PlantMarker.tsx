import { Circle, Text, Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { PLANT_STATUS_COLORS, type Plant } from '../types';

interface PlantMarkerProps {
  plant: Plant;
  x: number;
  y: number;
  radius?: number;
  onClick?: () => void;
}

export function PlantMarker({ plant, x, y, radius = 10, onClick }: PlantMarkerProps) {
  const handleClick = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    onClick?.();
  };

  const color = PLANT_STATUS_COLORS[plant.status] ?? '#a5d6a7';

  return (
    <Group x={x} y={y} onClick={handleClick} onTap={handleClick}>
      <Circle
        radius={radius}
        fill={color}
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