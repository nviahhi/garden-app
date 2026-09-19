import { Stage, Layer, Rect, Text, Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useEffect } from 'react';
import { useContainerStore } from '../store/useContainerStore';
import type { Container } from '../types';
import { CanvasGrid } from './CanvasGrid';
import { ContainerCells } from './ContainerCells';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const GRID_SIZE = 20;

interface GardenCanvasProps {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

function ContainerShape({
  container,
  isSelected,
  onSelect,
}: {
  container: Container;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const updateContainer = useContainerStore((s) => s.updateContainer);

  const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    const x = snapToGrid(e.target.x());
    const y = snapToGrid(e.target.y());
    e.target.position({ x, y });
    updateContainer(container.id, { x, y });
  };

  const hasCells = container.cols && container.rows && container.cols > 0 && container.rows > 0;  

  return (
    <Group
      x={container.x}
      y={container.y}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={handleDragEnd}
    >
      <Rect
        width={container.width}
        height={container.height}
        fill="#e8f5e9"
        stroke={isSelected ? '#2e7d32' : '#4a7c4a'}
        strokeWidth={isSelected ? 3 : 2}
        cornerRadius={6}
        shadowBlur={5}
        shadowColor="rgba(0,0,0,0.2)"
      />

      {hasCells && (
        <ContainerCells
          width={container.width}
          height={container.height}
          cols={container.cols!}
          rows={container.rows!}
        />
      )}

      <Text
        x={8}
        y={8}
        width={container.width - 16}
        text={container.name}
        fontSize={13}
        fill="#2e4a2e"
        fontStyle="bold"
        wrap="word"
        ellipsis
      />
      <Text
        x={8}
        y={36}
        width={container.width - 16}
        text={container.type}
        fontSize={11}
        fill="#6b8e6b"
        wrap="word"
        ellipsis
      />
    </Group>
  );
}

export function GardenCanvas({ selectedId, onSelect }: GardenCanvasProps) {
  const { containers, isLoading, loadContainers } = useContainerStore();

  useEffect(() => {
    loadContainers();
  }, [loadContainers]);

  const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) {
      onSelect(null);
    }
  };

  if (isLoading) return <div>Загрузка...</div>;

  return (
    <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT} onClick={handleStageClick}>
      <CanvasGrid width={CANVAS_WIDTH} height={CANVAS_HEIGHT} cellSize={GRID_SIZE} />
      <Layer>
        {containers.map((container) => (
          <ContainerShape
            key={container.id}
            container={container}
            isSelected={selectedId === container.id}
            onSelect={() => onSelect(container.id)}
          />
        ))}
      </Layer>
    </Stage>
  );
}