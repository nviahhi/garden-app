import { Stage, Layer, Rect, Text, Group } from 'react-konva';
import { useEffect } from 'react';
import { useContainerStore } from '../store/useContainerStore';
import type { Container } from '../types';
import type { KonvaEventObject } from 'konva/lib/Node';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

function ContainerShape({ container }: { container: Container }) {
  const moveContainer = useContainerStore((s) => s.moveContainer);

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    const x = Math.round(e.target.x());
    const y = Math.round(e.target.y());
    moveContainer(container.id, x, y);
  };

  return (
    <Group
      x={container.x}
      y={container.y}
      draggable
      onDragEnd={handleDragEnd}
    >
      <Rect
        width={container.width}
        height={container.height}
        fill="#e8f5e9"
        stroke="#4a7c4a"
        strokeWidth={2}
        cornerRadius={6}
        shadowBlur={5}
        shadowColor="rgba(0,0,0,0.2)"
      />
      <Text
        x={8}
        y={8}
        text={container.name}
        fontSize={13}
        fill="#2e4a2e"
        fontStyle="bold"
      />
      <Text
        x={8}
        y={26}
        text={container.type}
        fontSize={11}
        fill="#6b8e6b"
      />
    </Group>
  );
}

export function GardenCanvas() {
  const { containers, isLoading, loadContainers } = useContainerStore();

  useEffect(() => {
    loadContainers();
  }, [loadContainers]);

  if (isLoading) {
    return <div>Загрузка...</div>;
  }

  return (
    <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
      <Layer>
        {containers.map((container) => (
          <ContainerShape key={container.id} container={container} />
        ))}
      </Layer>
    </Stage>
  );
}