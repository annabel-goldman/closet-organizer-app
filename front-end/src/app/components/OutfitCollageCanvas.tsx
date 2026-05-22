import type { CSSProperties } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Moveable, {
  type OnDrag,
  type OnDragEnd,
  type OnDragStart,
  type OnResize,
  type OnResizeEnd,
  type OnResizeStart,
} from "react-moveable";
import { ClothingItem, buildPlaceholderLabel } from "../lib/closet";
import {
  clampCollageLayout,
  OutfitCollageLayout,
  resolveOutfitCollageLayouts,
  sortItemsByCollageLayer,
} from "../lib/outfitCollage";
import { PrimitiveText } from "./primitives/PrimitiveText";

const MOVEABLE_RENDER_DIRECTIONS = [ "nw", "ne", "sw", "se" ] as const;
const MIN_ITEM_SIZE_PERCENT = 8;
const COLLAGE_STAGE_ASPECT_RATIO = 4 / 5;

interface ActiveRotationGesture {
  itemId: number;
  startPointerAngle: number;
  startRotation: number;
}

interface OutfitCollageCanvasProps {
  className?: string;
  editable?: boolean;
  items: ClothingItem[];
  layouts?: Record<number, OutfitCollageLayout>;
  maxVisibleItems?: number;
  onLayoutsChange?: (layouts: Record<number, OutfitCollageLayout>) => void;
  onSelectItem?: (itemId: number | null) => void;
  selectedItemId?: number | null;
}

export function OutfitCollageCanvas({
  className = "",
  editable = false,
  items,
  layouts,
  maxVisibleItems,
  onLayoutsChange,
  onSelectItem,
  selectedItemId = null,
}: OutfitCollageCanvasProps) {
  const moveableRef = useRef<Moveable | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const itemFrameRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const transientRotationByItemId = useRef<Record<number, number>>({});
  const activeRotationGestureRef = useRef<ActiveRotationGesture | null>(null);
  const [imageAspectRatioByItemId, setImageAspectRatioByItemId] = useState<Record<number, number>>({});

  const resolvedLayouts = useMemo(
    () => resolveOutfitCollageLayouts(items, layouts),
    [items, layouts],
  );
  const orderedItems = useMemo(
    () => sortItemsByCollageLayer(items, resolvedLayouts),
    [items, resolvedLayouts],
  );
  const visibleItems = maxVisibleItems ? orderedItems.slice(0, maxVisibleItems) : orderedItems;
  const hiddenCount = Math.max(0, orderedItems.length - visibleItems.length);
  const normalizedLayouts = useMemo(
    () =>
      Object.fromEntries(
        visibleItems.map((item) => [
          item.id,
          normalizeLayoutToAspectRatio(resolvedLayouts[item.id], imageAspectRatioByItemId[item.id]),
        ]),
      ) as Record<number, OutfitCollageLayout>,
    [imageAspectRatioByItemId, resolvedLayouts, visibleItems],
  );
  const selectedTarget = editable && selectedItemId ? itemFrameRefs.current[selectedItemId] : null;
  const displayLayouts = editable ? resolvedLayouts : normalizedLayouts;

  useLayoutEffect(() => {
    if (editable && selectedItemId) {
      pinItemFrameToPixels(selectedItemId);
    }

    moveableRef.current?.updateRect();
  }, [displayLayouts, editable, selectedItemId]);

  useEffect(() => {
    if (!editable || !onLayoutsChange) {
      return;
    }

    const nextEntries = visibleItems
      .map((item) => {
        const currentLayout = resolvedLayouts[item.id];
        const normalizedLayout = normalizeLayoutToAspectRatio(currentLayout, imageAspectRatioByItemId[item.id]);
        return layoutsDiffer(currentLayout, normalizedLayout) ? [item.id, normalizedLayout] : null;
      })
      .filter((entry): entry is [number, OutfitCollageLayout] => Boolean(entry));

    if (nextEntries.length === 0) {
      return;
    }

    onLayoutsChange({
      ...resolvedLayouts,
      ...Object.fromEntries(nextEntries),
    });
  }, [editable, imageAspectRatioByItemId, onLayoutsChange, resolvedLayouts, visibleItems]);

  function updateItemLayout(itemId: number, nextPartial: Partial<OutfitCollageLayout>) {
    if (!onLayoutsChange) {
      return;
    }

    const baseLayout = resolvedLayouts[itemId];
    const nextLayout = clampCollageLayout({
      ...baseLayout,
      ...nextPartial,
    });

    onLayoutsChange({
      ...resolvedLayouts,
      [itemId]: nextLayout,
    });
  }

  function handleDrag(event: OnDrag) {
    if (!selectedItemId) {
      return;
    }
    event.target.style.left = `${event.left}px`;
    event.target.style.top = `${event.top}px`;
  }

  function handleResize(event: OnResize) {
    if (!selectedItemId) {
      return;
    }
    event.target.style.left = `${event.drag.left}px`;
    event.target.style.top = `${event.drag.top}px`;
    event.target.style.width = `${Math.max(event.width, 1)}px`;
    event.target.style.height = `${Math.max(event.height, 1)}px`;
  }

  function beginRotation(itemId: number, clientX: number, clientY: number) {
    const target = itemFrameRefs.current[itemId];
    if (!target) {
      return;
    }

    pinItemFrameToPixels(itemId);
    const frameRect = target.getBoundingClientRect();
    activeRotationGestureRef.current = {
      itemId,
      startPointerAngle: pointAngleFromRectCenter(frameRect, clientX, clientY),
      startRotation: transientRotationByItemId.current[itemId] ?? resolvedLayouts[itemId].rotation,
    };
  }

  function handleDragStart(_event: OnDragStart) {
    if (!selectedItemId) {
      return;
    }

    pinItemFrameToPixels(selectedItemId);
  }

  function handleResizeStart(event: OnResizeStart) {
    if (!selectedItemId) {
      return;
    }

    pinItemFrameToPixels(selectedItemId);
    event.setRatio(imageAspectRatioByItemId[selectedItemId] ?? (resolvedLayouts[selectedItemId].width / Math.max(resolvedLayouts[selectedItemId].height, 0.001)));
    event.dragStart?.set([ 0, 0 ]);
  }

  function handleGestureEnd(_event: OnDragEnd | OnResizeEnd) {
    if (!selectedItemId) {
      return;
    }

    commitItemFrameFromPixels(selectedItemId);
  }

  function handleStagePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!editable) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      onSelectItem?.(null);
      return;
    }

    if (selectedItemId && target.closest(".moveable-rotation-control")) {
      event.preventDefault();
      event.stopPropagation();
      beginRotation(selectedItemId, event.clientX, event.clientY);
      return;
    }

    if (
      target.closest("[data-collage-item-frame='true']")
      || target.closest(".moveable-control-box")
      || target.closest(".moveable-area")
      || target.closest(".moveable-control")
      || target.closest(".moveable-rotation-control")
      || target.closest(".moveable-line")
    ) {
      return;
    }

    onSelectItem?.(null);
  }

  function pinItemFrameToPixels(itemId: number) {
    const target = itemFrameRefs.current[itemId];
    const stageBounds = stageRef.current?.getBoundingClientRect();
    const layout = resolvedLayouts[itemId];

    if (!target || !stageBounds) {
      return;
    }

    target.style.left = `${(layout.x / 100) * stageBounds.width}px`;
    target.style.top = `${(layout.y / 100) * stageBounds.height}px`;
    target.style.width = `${(layout.width / 100) * stageBounds.width}px`;
    target.style.height = `${(layout.height / 100) * stageBounds.height}px`;
    target.style.transform = `rotate(${layout.rotation}deg)`;
    transientRotationByItemId.current[itemId] = layout.rotation;
  }

  function commitItemFrameFromPixels(itemId: number) {
    const target = itemFrameRefs.current[itemId];
    const stageBounds = stageRef.current?.getBoundingClientRect();

    if (!target || !stageBounds) {
      return;
    }

    updateItemLayout(itemId, {
      x: pixelsToPercent(parseFloat(target.style.left || "0"), stageBounds.width),
      y: pixelsToPercent(parseFloat(target.style.top || "0"), stageBounds.height),
      width: Math.max(MIN_ITEM_SIZE_PERCENT, pixelsToPercent(parseFloat(target.style.width || "0"), stageBounds.width)),
      height: Math.max(MIN_ITEM_SIZE_PERCENT, pixelsToPercent(parseFloat(target.style.height || "0"), stageBounds.height)),
      rotation: transientRotationByItemId.current[itemId] ?? 0,
    });
  }

  useEffect(() => {
    function handleWindowPointerMove(event: PointerEvent) {
      const gesture = activeRotationGestureRef.current;
      if (!gesture) {
        return;
      }

      const target = itemFrameRefs.current[gesture.itemId];
      if (!target) {
        return;
      }

      const frameRect = target.getBoundingClientRect();
      const nextPointerAngle = pointAngleFromRectCenter(frameRect, event.clientX, event.clientY);
      const nextRotation = gesture.startRotation + (nextPointerAngle - gesture.startPointerAngle);
      transientRotationByItemId.current[gesture.itemId] = nextRotation;
      target.style.transform = `rotate(${nextRotation}deg)`;
      moveableRef.current?.updateRect();
    }

    function handleWindowPointerEnd() {
      const gesture = activeRotationGestureRef.current;
      if (!gesture) {
        return;
      }

      activeRotationGestureRef.current = null;
      commitItemFrameFromPixels(gesture.itemId);
    }

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerEnd);
    window.addEventListener("pointercancel", handleWindowPointerEnd);

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerEnd);
      window.removeEventListener("pointercancel", handleWindowPointerEnd);
    };
  }, [resolvedLayouts]);
  return (
    <div
      ref={stageRef}
      className={`relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-stone-100 via-white to-stone-100 ${editable ? "touch-none" : ""} ${className}`.trim()}
      style={editable ? ({ "--moveable-color": "#111111" } as CSSProperties) : undefined}
      onPointerDown={handleStagePointerDown}
    >
      {visibleItems.map((item, index) => {
        const layout = displayLayouts[item.id] ?? resolvedLayouts[item.id];
        const isLastVisibleTile = index === visibleItems.length - 1;
        const showHiddenCount = hiddenCount > 0 && isLastVisibleTile && !editable;

        return (
          <div
            key={item.id}
            ref={(node) => {
              itemFrameRefs.current[item.id] = node;
            }}
            data-collage-item-frame="true"
            role={editable ? "button" : undefined}
            tabIndex={editable ? 0 : -1}
            className={`absolute overflow-visible ${editable ? "cursor-move" : ""}`}
            style={{
              left: `${layout.x}%`,
              top: `${layout.y}%`,
              width: `${layout.width}%`,
              height: `${layout.height}%`,
              transform: `rotate(${layout.rotation}deg)`,
              transformOrigin: "center center",
              zIndex: layout.layer_order + 1,
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              onSelectItem?.(item.id);
            }}
            onClick={(event) => {
              event.stopPropagation();
              onSelectItem?.(item.id);
            }}
          >
            <div className="relative h-full w-full overflow-hidden bg-transparent">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="pointer-events-none h-full w-full object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.12)]"
                  onLoad={(event) => {
                    const nextRatio = event.currentTarget.naturalWidth / Math.max(1, event.currentTarget.naturalHeight);
                    setImageAspectRatioByItemId((current) =>
                      nearlyEqual(current[item.id] ?? 0, nextRatio)
                        ? current
                        : {
                            ...current,
                            [item.id]: nextRatio,
                          },
                    );
                  }}
                />
              ) : (
                <div className="pointer-events-none flex h-full w-full items-end border border-border/40 bg-white/85 p-4 text-left shadow-sm">
                  <div>
                    <PrimitiveText as="p" variant="title" font="serif">
                      {item.name}
                    </PrimitiveText>
                  </div>
                </div>
              )}

              {showHiddenCount ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/45">
                  <PrimitiveText as="p" variant="title" font="serif" className="text-white">
                    +{hiddenCount}
                  </PrimitiveText>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}

      {editable && selectedTarget ? (
        <Moveable
          ref={moveableRef}
          target={selectedTarget}
          container={stageRef.current ?? undefined}
          draggable
          resizable
          rotatable
          keepRatio
          edge={false}
          origin={false}
          renderDirections={[ ...MOVEABLE_RENDER_DIRECTIONS ]}
          rotationPosition="top"
          throttleDrag={0}
          throttleResize={0}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleGestureEnd}
          onResizeStart={handleResizeStart}
          onResize={handleResize}
          onResizeEnd={handleGestureEnd}
        />
      ) : null}
    </div>
  );
}

function normalizeLayoutToAspectRatio(
  layout: OutfitCollageLayout,
  aspectRatio?: number,
): OutfitCollageLayout {
  if (!aspectRatio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return clampCollageLayout(layout);
  }

  const safeLayout = clampCollageLayout(layout);
  const currentRatio = (
    safeLayout.width * COLLAGE_STAGE_ASPECT_RATIO
  ) / Math.max(safeLayout.height, 0.001);

  if (Math.abs(currentRatio - aspectRatio) < 0.001) {
    return safeLayout;
  }

  if (currentRatio > aspectRatio) {
    const width = (safeLayout.height * aspectRatio) / COLLAGE_STAGE_ASPECT_RATIO;
    return clampCollageLayout({
      ...safeLayout,
      x: safeLayout.x + (safeLayout.width - width) / 2,
      width,
    });
  }

  const height = (safeLayout.width * COLLAGE_STAGE_ASPECT_RATIO) / aspectRatio;
  return clampCollageLayout({
    ...safeLayout,
    y: safeLayout.y + (safeLayout.height - height) / 2,
    height,
  });
}

function nearlyEqual(left: number, right: number, tolerance = 0.002) {
  return Math.abs(left - right) <= tolerance;
}

function layoutsDiffer(left: OutfitCollageLayout, right: OutfitCollageLayout) {
  return (
    !nearlyEqual(left.x, right.x)
    || !nearlyEqual(left.y, right.y)
    || !nearlyEqual(left.width, right.width)
    || !nearlyEqual(left.height, right.height)
    || !nearlyEqual(left.rotation, right.rotation)
    || left.layer_order !== right.layer_order
  );
}

function pointAngleFromRectCenter(rect: DOMRect, clientX: number, clientY: number) {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  return Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
}

function pixelsToPercent(value: number, total: number) {
  if (!Number.isFinite(value) || total <= 0) {
    return 0;
  }

  return (value / total) * 100;
}

interface OutfitCollageLayersPanelProps {
  items: ClothingItem[];
  layouts: Record<number, OutfitCollageLayout>;
  onReorder: (orderedItemIds: number[]) => void;
  onSelectItem: (itemId: number) => void;
  selectedItemId?: number | null;
}

export function OutfitCollageLayersPanel({
  items,
  layouts,
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
  const lastDropTargetIdRef = useRef<number | null>(null);

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
  }, [draggingItemId]);

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

  function handleLayerPointerDown(itemId: number) {
    onSelectItem(itemId);
    setDraggingItemId(itemId);
    setDragHoverItemId(itemId);
    lastDropTargetIdRef.current = itemId;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 border border-border bg-card/90 p-3">
      <PrimitiveText as="p" variant="overline" tone="muted">
        Layers
      </PrimitiveText>
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
              className={`group flex aspect-[3/4] w-full items-center justify-center overflow-hidden border bg-background transition-colors ${
                isSelected ? "border-foreground shadow-[0_0_0_1px_rgba(17,17,17,0.18)]" : "border-border hover:bg-stone-50"
              } ${
                draggingItemId === item.id ? "cursor-grabbing opacity-80" : "cursor-grab"
              } ${
                dragHoverItemId === item.id && draggingItemId && draggingItemId !== item.id ? "border-foreground/70 bg-stone-50" : ""
              }`}
              aria-label={`Select layer ${item.name}`}
              title={item.name}
            >
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
    </div>
  );
}
