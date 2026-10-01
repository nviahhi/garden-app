import { Group, Layer, Rect, Text, Line } from 'react-konva';
import type { Zone } from '../types';

interface ZoneBackgroundProps {
  zone: Zone;
}

export function ZoneBackground({ zone }: ZoneBackgroundProps) {
  const shelves = zone.shelves ?? [];
  const showShelves = zone.type === 'shelf' && shelves.length > 0;

  return (
    <Layer listening={false}>
      {/* Фон зоны */}
      <Rect
        x={0}
        y={0}
        width={zone.canvas_width}
        height={zone.canvas_height}
        fill={zone.background_color}
      />

      {/* Полосы полок (только для стеллажа) */}
      {showShelves &&
        shelves.map((shelf) => (
          <Group key={shelf.id}>
            {/* Фон полосы */}
            <Rect
              x={0}
              y={shelf.y}
              width={zone.canvas_width}
              height={shelf.height}
              fill={shelf.color}
              opacity={0.55}
            />

            {/* Верхняя граница полосы */}
            <Line
              points={[0, shelf.y, zone.canvas_width, shelf.y]}
              stroke="#c8b89a"
              strokeWidth={2}
            />

            {/* Подпись полки */}
            <Text
              x={12}
              y={shelf.y + 6}
              text={shelf.name}
              fontSize={11}
              fill="#8b7355"
              fontStyle="bold"
            />
          </Group>
        ))}
    </Layer>
  );
}