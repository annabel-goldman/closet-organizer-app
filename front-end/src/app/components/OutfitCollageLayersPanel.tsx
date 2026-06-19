import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { ClothingItem, buildPlaceholderLabel } from "../lib/closet";
import { OutfitCollageLayout, sortItemsByCollageLayer } from "../lib/outfitCollage";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface OutfitCollageLayersPanelProps {
  availableItems: ClothingItem[];
  items: ClothingItem[];
  layouts: Record<number, OutfitCollageLayout>;
  onAddItem: (itemId: number) => void;
  onRemoveItem: (itemId: number) => void;
  onReorder: (orderedItemIds: number[]) => void;
  onSelectItem: (itemId: number) => void;
  selectedItemId?: number | null;
}

export function OutfitCollageLayersPanel({
  availableItems,
  items,
  layouts,
  onAddItem,
  onRemoveItem,
  onReorder,
  onSelectItem,
  selectedItemId = null,
}: OutfitCollageLayersPanelProps) {
  const orderedItems = useMemo(
    () => [...sortItemsByCollageLayer(items, layouts)].reverse(),
    [items, layouts],
  );
  const [draggingItemId, setDraggingItemId] = useState<number | null>(null);
  const [dragHoverItemId, setDragHoverItemId] = useState<number | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const lastDropTargetIdRef = useRef<number | null>(null);
  const keyboardHintId = useId();

  useEffect(() => {
    if (!draggingItemId) {
      return;
    }

    function handleWindowPointerMove(event: PointerEvent) {
      const hoveredElement = document.elementFromPoint(event.clientX, event.clientY);
      const layerButton = hoveredElement instanceof HTMLElement
        ? hoveredElement.closest<HTMLElement>("[data-layer-item-id]")
        : null;

      if (!layerButton) {
        setDragHoverItemId(null);
        return;
      }

      const targetItemId = Number(layerButton.dataset.layerItemId);
      if (!Number.isFinite(targetItemId)) {
        return;
      }

      setDragHoverItemId(targetItemId);
      if (lastDropTargetIdRef.current === targetItemId) {
        return;
      }

      reorderItems(draggingItemId, targetItemId);
      lastDropTargetIdRef.current = targetItemId;
    }

    function handleWindowPointerUp() {
      setDraggingItemId(null);
      setDragHoverItemId(null);
      lastDropTargetIdRef.current = null;
    }

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerUp);

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerUp);
    };
  }, [draggingItemId, orderedItems]);

  function reorderItems(draggedItemId: number, targetItemId: number) {
    if (draggedItemId === targetItemId) {
      return;
    }

    const reordered = [...orderedItems];
    const draggingIndex = reordered.findIndex((entry) => entry.id === draggedItemId);
    const targetIndex = reordered.findIndex((entry) => entry.id === targetItemId);
    if (draggingIndex < 0 || targetIndex < 0) {
      return;
    }

    const [draggingItem] = reordered.splice(draggingIndex, 1);
    reordered.splice(targetIndex, 0, draggingItem);
    onReorder([...reordered].reverse().map((entry) => entry.id));
  }

  function moveItemToIndex(itemId: number, targetIndex: number) {
    const currentIndex = orderedItems.findIndex((entry) => entry.id === itemId);
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedItems.length || currentIndex === targetIndex) {
      return;
    }

    const reordered = [...orderedItems];
    const [item] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, item);
    onReorder([...reordered].reverse().map((entry) => entry.id));
  }

  function handleLayerPointerDown(itemId: number) {
    onSelectItem(itemId);
    setDraggingItemId(itemId);
    setDragHoverItemId(itemId);
    lastDropTargetIdRef.current = itemId;
  }

  function handleLayerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, itemId: number) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectItem(itemId);
      return;
    }

    if (!event.altKey) {
      return;
    }

    const currentIndex = orderedItems.findIndex((entry) => entry.id === itemId);
    if (currentIndex < 0) {
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveItemToIndex(itemId, Math.max(0, currentIndex - 1));
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveItemToIndex(itemId, Math.min(orderedItems.length - 1, currentIndex + 1));
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      moveItemToIndex(itemId, 0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      moveItemToIndex(itemId, orderedItems.length - 1);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 border border-border bg-card/90 p-2 sm:gap-3 sm:p-3">
      <PrimitiveText as="p" variant="overline" tone="muted" className="text-[0.65rem] sm:text-[0.7rem]">
        Items
      </PrimitiveText>
      <p id={keyboardHintId} className="sr-only">
        Press Enter or Space to select an item. Press Option plus Arrow Up or Arrow Down to reorder items.
      </p>
      <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
        {orderedItems.map((item) => {
          const isSelected = selectedItemId === item.id;

          return (
            <button
              key={item.id}
              type="button"
              data-layer-item-id={item.id}
              onClick={() => onSelectItem(item.id)}
              onPointerDown={(event) => {
                event.preventDefault();
                handleLayerPointerDown(item.id);
              }}
              onKeyDown={(event) => handleLayerKeyDown(event, item.id)}
              className={`group relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden border bg-background transition-colors ${
                isSelected ? "border-foreground shadow-[0_0_0_1px_rgba(17,17,17,0.18)]" : "border-border hover:bg-stone-50"
              } ${
                draggingItemId === item.id ? "cursor-grabbing opacity-80" : "cursor-grab"
              } ${
                dragHoverItemId === item.id && draggingItemId && draggingItemId !== item.id ? "border-foreground/70 bg-stone-50" : ""
              }`}
              aria-describedby={keyboardHintId}
              aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+Home Alt+End"
              aria-label={`Select item ${item.name}`}
              title={item.name}
            >
              <PrimitiveButton
                type="button"
                variant="outline"
                size="icon"
                className="absolute right-1.5 top-1.5 z-10 h-5.5 w-5.5 border-white/70 bg-white/85 text-stone-700 shadow-sm hover:bg-white"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onRemoveItem(item.id);
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                aria-label={`Remove ${item.name} from outfit`}
                title={`Remove ${item.name}`}
              >
                <X className="h-3 w-3" />
              </PrimitiveButton>
              {item.image_url ? (
                <img src={item.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <PrimitiveText as="span" variant="bodySm" tone="muted">
                  {buildPlaceholderLabel(item.name) || "?"}
                </PrimitiveText>
              )}
            </button>
          );
        })}
      </div>
      <Popover open={isAddOpen} onOpenChange={setIsAddOpen}>
        <PopoverTrigger asChild>
          <PrimitiveButton
            type="button"
            variant="outline"
            size="icon"
            className="mt-auto h-8 w-8 self-center border-dashed"
            disabled={availableItems.length === 0}
            aria-label="Add item to outfit"
            title="Add item"
          >
            <Plus className="h-3.5 w-3.5" />
          </PrimitiveButton>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={12}
          collisionPadding={{ top: 16, right: 16, bottom: 76, left: 16 }}
          className="flex max-h-[24rem] w-[15.5rem] flex-col overflow-hidden border-border p-0 shadow-[0_18px_40px_rgba(15,23,42,0.16)]"
        >
          <div className="shrink-0 border-b border-border px-3 py-2.5">
            <PrimitiveText as="p" variant="overline" tone="muted" className="mb-1">
              Add Item
            </PrimitiveText>
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3"
            onWheel={(event) => event.stopPropagation()}
          >
            {availableItems.length === 0 ? (
              <div className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                All closet items are already in this outfit.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {availableItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onAddItem(item.id);
                      setIsAddOpen(false);
                    }}
                    className="group text-left"
                    aria-label={`Add ${item.name} to outfit`}
                    title={item.name}
                  >
                    <div className="relative aspect-[3/4] overflow-hidden border border-border bg-background transition-colors group-hover:bg-stone-50">
                      {item.image_url ? (
                        <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <PrimitiveText as="span" variant="bodySm" tone="muted">
                            {buildPlaceholderLabel(item.name) || "?"}
                          </PrimitiveText>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
