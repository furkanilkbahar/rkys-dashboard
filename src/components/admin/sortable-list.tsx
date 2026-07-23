"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

function SortableItem({ id, children }: { id: string; children: (dragHandle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const dragHandle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
    >
      <GripVertical className="size-4" aria-hidden="true" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      {children(dragHandle)}
    </div>
  );
}

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  className,
}: {
  items: T[];
  onReorder: (orderedIds: string[]) => Promise<unknown>;
  renderItem: (item: T, dragHandle: ReactNode) => ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [localItems, setLocalItems] = useState(items);
  const [prevItems, setPrevItems] = useState(items);

  // Prop değiştiğinde (router.refresh() sonrası yeni sıra) local state'i
  // senkronlar — useEffect yerine render sırasında (React'in "adjusting
  // state when props change" deseni), gereksiz ekstra render turu olmadan.
  if (items !== prevItems) {
    setPrevItems(items);
    setLocalItems(items);
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localItems.findIndex((i) => i.id === active.id);
    const newIndex = localItems.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(localItems, oldIndex, newIndex);
    setLocalItems(reordered);

    await onReorder(reordered.map((i) => i.id));
    router.refresh();
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={localItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {localItems.map((item) => (
            <SortableItem key={item.id} id={item.id}>
              {(dragHandle) => renderItem(item, dragHandle)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
