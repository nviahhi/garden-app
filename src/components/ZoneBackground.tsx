import { Group, Rect, Text, Line } from 'react-konva';
import type { Zone } from '../types';

interface ZoneBackgroundProps {
  zone: Zone;
}

export function ZoneBackground({ zone }: ZoneBackgroundProps) {
  const shelves = zone.shelves ?? [];
  const showShelves = zone.type === 'shelf' && shelves.length > 0;

  return (
    <Group listening={false}>
      <Rect
        x={0}
        y={0}
        width={zone.canvas_width}
        height={zone.canvas_height}
        fill={zone.background_color}
      />

    {showShelves &&
      shelves.map((shelf) => {
        const bottomY = shelf.y + shelf.height;
        // Сдвигаем нижнюю доску чуть вверх, чтобы она не обрезалась
        const boardY = Math.min(bottomY, zone.canvas_height - 3);

        return (
          <Group key={shelf.id}>
            <Rect
              x={0}
              y={shelf.y}
              width={zone.canvas_width}
              height={shelf.height}
              fill={shelf.color}
              opacity={0.3}
            />
            <Line
              points={[0, boardY, zone.canvas_width, boardY]}
              stroke="#c89860"
              strokeWidth={6}
              lineCap="round"
            />
            <Line
              points={[0, boardY + 4, zone.canvas_width, boardY + 4]}
              stroke="rgba(0,0,0,0.08)"
              strokeWidth={2}
            />
            <Text
              x={zone.canvas_width - 100}
              y={boardY - 18}
              width={88}
              text={shelf.name}
              fontSize={11}
              fill="#8b7355"
              fontStyle="bold"
              align="right"
            />
          </Group>
        );
      })}
    </Group>
  );
}