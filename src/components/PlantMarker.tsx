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

export function PlantMarker({ plant, x, y, radius = 11, onClick }: PlantMarkerProps) {
  const handleClick = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    onClick?.();
  };

  const handleMouseEnter = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = 'pointer';
  };

  const handleMouseLeave = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = 'default';
  };

  const color = PLANT_STATUS_COLORS[plant.status] ?? '#a5d6a7';

  // Берём сквозной номер, fallback на локальный
  const num = plant.display_number ?? plant.number;
  const numberStr = String(num);

  // Адаптивный шрифт под длину номера
  let fontSize: number;
  if (numberStr.length >= 4) fontSize = radius * 0.55;
  else if (numberStr.length === 3) fontSize = radius * 0.75;
  else if (numberStr.length === 2) fontSize = radius * 0.95;
  else fontSize = radius * 1.15;

  return (
    <Group
      x={x}
      y={y}
      onClick={handleClick}
      onTap={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Основной кружок */}
      <Circle
        radius={radius}
        fill={color}
        stroke="#2e4a2e"
        strokeWidth={1.5}
        shadowBlur={4}
        shadowColor="rgba(0,0,0,0.25)"
        shadowOffsetY={1}
      />

      {/* Внутренняя тонкая обводка — придаёт объём */}
      <Circle
        radius={radius - 1.5}
        stroke="rgba(255,255,255,0.7)"
        strokeWidth={1}
        listening={false}
      />

      {/* Номер */}
      <Text
        text={numberStr}
        fontSize={fontSize}
        fontFamily="Inter, -apple-system, sans-serif"
        fill="#1a2e1a"
        fontStyle="bold"
        width={radius * 2}
        height={radius * 2}
        offsetX={radius}
        offsetY={radius}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
    </Group>
  );
}