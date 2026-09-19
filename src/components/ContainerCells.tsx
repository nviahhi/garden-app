import { Line } from 'react-konva';

interface ContainerCellsProps {
  width: number;
  height: number;
  cols: number;
  rows: number;
  padding?: number;      // отступы от краёв контейнера
  headerHeight?: number; // высота заголовка (где название и тип)
}

export function ContainerCells({
  width,
  height,
  cols,
  rows,
  padding = 6,
  headerHeight = 44,
}: ContainerCellsProps) {
  // Доступная область под сетку
  const gridWidth = width - padding * 2;
  const gridHeight = height - headerHeight - padding;

  if (gridWidth <= 0 || gridHeight <= 0) return null;

  const cellWidth = gridWidth / cols;
  const cellHeight = gridHeight / rows;

  const cells = [];

  // Вертикальные линии
  for (let i = 0; i <= cols; i++) {
    const x = padding + i * cellWidth;
    cells.push(
      <Line
        key={`v-${i}`}
        points={[x, headerHeight, x, headerHeight + gridHeight]}
        stroke="#a5c8a5"
        strokeWidth={1}
        listening={false}
      />
    );
  }

  // Горизонтальные линии
  for (let j = 0; j <= rows; j++) {
    const y = headerHeight + j * cellHeight;
    cells.push(
      <Line
        key={`h-${j}`}
        points={[padding, y, padding + gridWidth, y]}
        stroke="#a5c8a5"
        strokeWidth={1}
        listening={false}
      />
    );
  }

  return <>{cells}</>;
}