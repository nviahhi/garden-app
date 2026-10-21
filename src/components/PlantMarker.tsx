import { Circle, Text, Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { PLANT_STATUS_COLORS, type Plant } from '../types';

interface PlantMarkerProps {
  plant: Plant;
  x: number;
  y: number;
  radius?: number;
  isSelected?: boolean;
  onClick?: () => void;
  onDragStart?: (e: KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: KonvaEventObject<DragEvent>) => void;
}

export function PlantMarker({
  plant,
  x,
  y,
  radius = 10,
  isSelected = false,
  onClick,
  onDragStart,
  onDragEnd,
}: PlantMarkerProps) {
  const handleClick = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    onClick?.();
  };

  const handleDragStart = (e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = 'grabbing';
    onDragStart?.(e);
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = 'default';
    onDragEnd?.(e);
    e.target.position({ x, y });
  };

  const handleMouseEnter = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = onDragEnd ? 'grab' : 'pointer';
  };

  const handleMouseLeave = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = 'default';
  };

  const color = PLANT_STATUS_COLORS[plant.status] ?? '#a5d6a7';
  const num = plant.display_number ?? plant.number;
  const numberStr = String(num);

  let fontSize: number;
  if (numberStr.length >= 4) fontSize = radius * 0.55;
  else if (numberStr.length === 3) fontSize = radius * 0.75;
  else if (numberStr.length === 2) fontSize = radius * 0.95;
  else fontSize = radius * 1.15;

  const isDraggable = !!onDragEnd;

  return (
    <Group
      x={x}
      y={y}
      draggable={isDraggable}
      onClick={handleClick}
      onTap={handleClick}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >

      {/* Внешнее кольцо выделения */}
      {isSelected && (
        <Circle
          radius={radius + 4}
          stroke="rgba(46, 125, 50, 0.35)"
          strokeWidth={8}
          listening={false}
        />
      )}

      <Circle
        radius={radius}
        fill={color}
        stroke={isSelected ? '#1b5e20' : '#2e4a2e'}
        strokeWidth={isSelected ? 2.5 : 1.5}
        shadowBlur={isSelected ? 12 : 4}
        shadowColor={isSelected ? '#4caf50' : 'rgba(0,0,0,0.25)'}
        shadowOffsetY={1}
      />

      <Circle
        radius={radius - 1.5}
        stroke="rgba(255,255,255,0.7)"
        strokeWidth={1}
        listening={false}
      />

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