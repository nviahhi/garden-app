import { Layer, Path } from 'react-konva';

interface CanvasGridProps {
  width: number;
  height: number;
  cellSize?: number;
  color?: string;
}

export function CanvasGrid({
  width,
  height,
  cellSize = 20,
  color = '#e0e0e0',
}: CanvasGridProps) {
  let path = '';

  for (let x = 0; x <= width; x += cellSize) {
    path += `M ${x} 0 L ${x} ${height} `;
  }
  for (let y = 0; y <= height; y += cellSize) {
    path += `M 0 ${y} L ${width} ${y} `;
  }

  return (
    <Layer listening={false}>
      <Path data={path} stroke={color} strokeWidth={0.5} />
    </Layer>
  );
}