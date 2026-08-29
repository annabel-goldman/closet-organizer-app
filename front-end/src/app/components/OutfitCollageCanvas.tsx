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
import { ClothingItem, OutfitDecoration } from "../lib/closet";
import {
  ImageContentBounds,
  measureImageContentBounds,
} from "../lib/outfitImageBounds";
import {
  clampCollageLayout,
  OutfitCollageLayout,
  resolveOutfitCollageLayouts,
  sortItemsByCollageLayer,
} from "../lib/outfitCollage";
import {
  COLLAGE_STAGE_ASPECT_RATIO,
  resolveOutfitCollageMediaBox,
  resolveOutfitCollageResizeAspectRatio,
} from "../lib/outfitCollageRenderMath";
import { PrimitiveText } from "./primitives/PrimitiveText";

const MOVEABLE_RENDER_DIRECTIONS = [ "nw", "ne", "sw", "se" ] as const;
const MIN_ITEM_SIZE_PERCENT = 8;
const MIN_DECORATION_SIZE_PERCENT = 5;
const MAX_DECORATION_SIZE_PERCENT = 60;

type CollageSelection =
  | { id: number; kind: "decoration" }
  | { id: number; kind: "item" };

interface ActiveRotationGesture {
  selection: CollageSelection;
  startPointerAngle: number;
  startRotation: number;
}

interface ImageMeasurementState {
  bounds: ImageContentBounds | null;
  sourceKey: string;
  status: "pending" | "ready";
}

interface OutfitCollageCanvasProps {
  className?: string;
  decorations?: OutfitDecoration[];
  editable?: boolean;
  items: ClothingItem[];
  layouts?: Record<number, OutfitCollageLayout>;
  maxVisibleItems?: number;
  onDecorationChange?: (placement: OutfitDecoration, changes: Partial<OutfitDecoration>) => void;
  onLayoutsChange?: (layouts: Record<number, OutfitCollageLayout>) => void;
  onSelectDecoration?: (decorationId: number | null) => void;
  onSelectItem?: (itemId: number | null) => void;
  selectedDecorationId?: number | null;
  selectedItemId?: number | null;
}
export function OutfitCollageCanvas({
  className = "",
  decorations = [],
  editable = false,
  items,
  layouts,
  maxVisibleItems,
  onDecorationChange,
  onLayoutsChange,
  onSelectDecoration,
  onSelectItem,
  selectedDecorationId = null,
  selectedItemId = null,
}: OutfitCollageCanvasProps) {
  const moveableRef = useRef<Moveable | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const decorationFrameRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const itemFrameRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const transientRotationBySelection = useRef<Record<string, number>>({});
  const activeRotationGestureRef = useRef<ActiveRotationGesture | null>(null);
  const [decorationMeasurementById, setDecorationMeasurementById] = useState<Record<number, ImageMeasurementState>>({});
  const [decorationAspectRatioById, setDecorationAspectRatioById] = useState<Record<number, number>>({});
  const [imageMeasurementByItemId, setImageMeasurementByItemId] = useState<Record<number, ImageMeasurementState>>({});
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
  const selectedDecoration = selectedDecorationId
    ? decorations.find((decoration) => decoration.id === selectedDecorationId) ?? null
    : null;
  const selectedItem = selectedItemId
    ? visibleItems.find((item) => item.id === selectedItemId)
    : null;
  const selection: CollageSelection | null = selectedDecoration
    ? { id: selectedDecoration.id, kind: "decoration" }
    : selectedItem
      ? { id: selectedItem.id, kind: "item" }
      : null;
  const selectedTarget = editable && selection
    ? selection.kind === "decoration"
      ? decorationFrameRefs.current[selection.id]
      : itemFrameRefs.current[selection.id]
    : null;
  const selectedSourceKey = selectedDecoration?.image_url ?? selectedItem?.image_url;
  const selectedMeasurement = selectedDecoration
    ? decorationMeasurementById[selectedDecoration.id]
    : selectedItem
      ? imageMeasurementByItemId[selectedItem.id]
      : null;
  const selectedResizeReady = Boolean(
    !selectedSourceKey
    || (
      selectedMeasurement?.sourceKey === selectedSourceKey
      && selectedMeasurement.status === "ready"
    ),
  );
  const displayLayouts = resolvedLayouts;

  useEffect(() => {
    let cancelled = false;

    items.forEach((item) => {
      const sourceKey = item.image_url;
      if (!sourceKey) {
        return;
      }

      setImageMeasurementByItemId((current) => {
        const existing = current[item.id];
        if (existing?.sourceKey === sourceKey) {
          return current;
        }

        return {
          ...current,
          [item.id]: { bounds: null, sourceKey, status: "pending" },
        };
      });

      void measureImageContentBounds({ imageUrl: sourceKey }).then((nextBounds) => {
        if (cancelled) {
          return;
        }

        setImageMeasurementByItemId((current) => {
          if (current[item.id]?.sourceKey !== sourceKey) {
            return current;
          }

          return {
            ...current,
            [item.id]: { bounds: nextBounds, sourceKey, status: "ready" },
          };
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [items]);

  useEffect(() => {
    let cancelled = false;

    decorations.forEach((decoration) => {
      const sourceKey = decoration.image_url;
      if (!sourceKey) return;

      setDecorationMeasurementById((current) => {
        if (current[decoration.id]?.sourceKey === sourceKey) return current;
        return {
          ...current,
          [decoration.id]: { bounds: null, sourceKey, status: "pending" },
        };
      });

      void measureImageContentBounds({ imageUrl: sourceKey }).then((nextBounds) => {
        if (cancelled) return;
        setDecorationMeasurementById((current) => {
          if (current[decoration.id]?.sourceKey !== sourceKey) return current;
          return {
            ...current,
            [decoration.id]: { bounds: nextBounds, sourceKey, status: "ready" },
          };
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [decorations]);

  function syncFrameToPercentLayout(itemId: number, layout: OutfitCollageLayout) {
    const target = itemFrameRefs.current[itemId];
    if (!target) {
      return;
    }

    target.style.left = `${layout.x}%`;
    target.style.top = `${layout.y}%`;
    target.style.width = `${layout.width}%`;
    target.style.height = `${layout.height}%`;
    target.style.transform = `rotate(${layout.rotation}deg)`;
  }

  function syncFrameToPixelLayout(itemId: number, layout: OutfitCollageLayout, stageBounds: DOMRect) {
    const target = itemFrameRefs.current[itemId];
    if (!target) {
      return;
    }

    target.style.left = `${(layout.x / 100) * stageBounds.width}px`;
    target.style.top = `${(layout.y / 100) * stageBounds.height}px`;
    target.style.width = `${(layout.width / 100) * stageBounds.width}px`;
    target.style.height = `${(layout.height / 100) * stageBounds.height}px`;
    target.style.transform = `rotate(${layout.rotation}deg)`;
  }

  function syncDecorationFrameToPercentLayout(decoration: OutfitDecoration) {
    const target = decorationFrameRefs.current[decoration.id];
    if (!target) return;

    target.style.left = `${decoration.x}%`;
    target.style.top = `${decoration.y}%`;
    target.style.width = `${decoration.width}%`;
    target.style.height = `${decorationHeightPercent(
      decoration.width,
      resolveDecorationAspectRatio(decoration, decorationMeasurementById, decorationAspectRatioById),
    )}%`;
    target.style.transform = `rotate(${decoration.rotation}deg)`;
  }

  function syncDecorationFrameToPixelLayout(decoration: OutfitDecoration, stageBounds: DOMRect) {
    const target = decorationFrameRefs.current[decoration.id];
    if (!target) return;

    target.style.left = `${(decoration.x / 100) * stageBounds.width}px`;
    target.style.top = `${(decoration.y / 100) * stageBounds.height}px`;
    target.style.width = `${(decoration.width / 100) * stageBounds.width}px`;
    target.style.height = `${(
      decorationHeightPercent(
        decoration.width,
        resolveDecorationAspectRatio(decoration, decorationMeasurementById, decorationAspectRatioById),
      ) / 100
    ) * stageBounds.height}px`;
    target.style.transform = `rotate(${decoration.rotation}deg)`;
  }

  useLayoutEffect(() => {
    visibleItems.forEach((item) => {
      const layout = displayLayouts[item.id] ?? resolvedLayouts[item.id];
      if (!layout) {
        return;
      }

      syncFrameToPercentLayout(item.id, layout);
    });
    decorations.forEach((decoration) => {
      const target = decorationFrameRefs.current[decoration.id];
      if (!target) return;
      target.style.left = `${decoration.x}%`;
      target.style.top = `${decoration.y}%`;
      target.style.width = `${decoration.width}%`;
      target.style.height = `${decorationHeightPercent(
        decoration.width,
        resolveDecorationAspectRatio(decoration, decorationMeasurementById, decorationAspectRatioById),
      )}%`;
      target.style.transform = `rotate(${decoration.rotation}deg)`;
    });
    moveableRef.current?.updateRect();
  }, [decorationAspectRatioById, decorations, decorationMeasurementById, displayLayouts, resolvedLayouts, selectedDecorationId, selectedItemId, selectedResizeReady, visibleItems]);

  function updateItemLayout(itemId: number, nextPartial: Partial<OutfitCollageLayout>) {
    if (!onLayoutsChange) {
      return;
    }

    const baseLayout = displayLayouts[itemId] ?? resolvedLayouts[itemId];
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
    if (!selection) return;
    event.target.style.left = `${event.left}px`;
    event.target.style.top = `${event.top}px`;
  }

  function handleResize(event: OnResize) {
    if (!selection) return;
    event.target.style.left = `${event.drag.left}px`;
    event.target.style.top = `${event.drag.top}px`;
    event.target.style.width = `${Math.max(event.width, 1)}px`;
    event.target.style.height = `${Math.max(event.height, 1)}px`;
  }

  function beginRotation(activeSelection: CollageSelection, clientX: number, clientY: number) {
    const target = selectionTarget(activeSelection);
    if (!target) return;

    pinSelectionToPixels(activeSelection);
    const frameRect = target.getBoundingClientRect();
    const selectionKey = collageSelectionKey(activeSelection);
    activeRotationGestureRef.current = {
      selection: activeSelection,
      startPointerAngle: pointAngleFromRectCenter(frameRect, clientX, clientY),
      startRotation: transientRotationBySelection.current[selectionKey] ?? selectionRotation(activeSelection),
    };
  }

  function handleDragStart(_event: OnDragStart) {
    if (selection) pinSelectionToPixels(selection);
  }

  function handleResizeStart(event: OnResizeStart) {
    if (!selection) return;

    pinSelectionToPixels(selection);
    if (selection.kind === "decoration") {
      const decoration = decorations.find((entry) => entry.id === selection.id);
      if (!decoration) return;
      event.setRatio(resolveDecorationAspectRatio(decoration, decorationMeasurementById, decorationAspectRatioById));
    } else {
      const selectedLayout = displayLayouts[selection.id] ?? resolvedLayouts[selection.id];
      const measurement = imageMeasurementByItemId[selection.id];
      event.setRatio(resolveOutfitCollageResizeAspectRatio({
        contentBoundsAspectRatio: measurement?.status === "ready"
          ? measurement.bounds?.aspectRatio
          : undefined,
        intrinsicAspectRatio: imageAspectRatioByItemId[selection.id],
        layout: selectedLayout,
      }));
    }
    if (event.dragStart) {
      event.dragStart.set([ 0, 0 ]);
    }
  }

  function handleGestureEnd(_event: OnDragEnd | OnResizeEnd) {
    if (selection) commitSelectionFromPixels(selection);
  }

  function handleStagePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!editable) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      onSelectItem?.(null);
      onSelectDecoration?.(null);
      return;
    }

    if (selection && target.closest(".moveable-rotation-control")) {
      event.preventDefault();
      event.stopPropagation();
      beginRotation(selection, event.clientX, event.clientY);
      return;
    }

    if (
      target.closest("[data-collage-item-frame='true']")
      || target.closest("[data-collage-decoration-frame='true']")
      || target.closest(".moveable-control-box")
      || target.closest(".moveable-area")
      || target.closest(".moveable-control")
      || target.closest(".moveable-rotation-control")
      || target.closest(".moveable-line")
    ) {
      return;
    }

    onSelectItem?.(null);
    onSelectDecoration?.(null);
  }

  function selectionTarget(activeSelection: CollageSelection) {
    return activeSelection.kind === "decoration"
      ? decorationFrameRefs.current[activeSelection.id]
      : itemFrameRefs.current[activeSelection.id];
  }

  function selectionRotation(activeSelection: CollageSelection) {
    if (activeSelection.kind === "decoration") {
      return decorations.find((entry) => entry.id === activeSelection.id)?.rotation ?? 0;
    }
    return (displayLayouts[activeSelection.id] ?? resolvedLayouts[activeSelection.id]).rotation;
  }

  function pinSelectionToPixels(activeSelection: CollageSelection) {
    const stageBounds = stageRef.current?.getBoundingClientRect();
    if (!stageBounds) return;

    if (activeSelection.kind === "decoration") {
      const decoration = decorations.find((entry) => entry.id === activeSelection.id);
      if (!decoration) return;
      syncDecorationFrameToPixelLayout(decoration, stageBounds);
    } else {
      const layout = displayLayouts[activeSelection.id] ?? resolvedLayouts[activeSelection.id];
      syncFrameToPixelLayout(activeSelection.id, layout, stageBounds);
    }
    transientRotationBySelection.current[collageSelectionKey(activeSelection)] = selectionRotation(activeSelection);
  }

  function commitItemFrameFromPixels(itemId: number) {
    const target = itemFrameRefs.current[itemId];
    const stageBounds = stageRef.current?.getBoundingClientRect();
    const baseLayout = displayLayouts[itemId] ?? resolvedLayouts[itemId];

    if (!target || !stageBounds || !baseLayout) {
      return;
    }

    const nextLayout = clampCollageLayout({
      ...baseLayout,
      x: pixelsToPercent(parseFloat(target.style.left || "0"), stageBounds.width),
      y: pixelsToPercent(parseFloat(target.style.top || "0"), stageBounds.height),
      width: Math.max(MIN_ITEM_SIZE_PERCENT, pixelsToPercent(parseFloat(target.style.width || "0"), stageBounds.width)),
      height: Math.max(MIN_ITEM_SIZE_PERCENT, pixelsToPercent(parseFloat(target.style.height || "0"), stageBounds.height)),
      rotation: transientRotationBySelection.current[collageSelectionKey({ id: itemId, kind: "item" })] ?? 0,
    });

    syncFrameToPercentLayout(itemId, nextLayout);
    updateItemLayout(itemId, nextLayout);
  }

  function commitDecorationFrameFromPixels(decorationId: number) {
    const decoration = decorations.find((entry) => entry.id === decorationId);
    const target = decorationFrameRefs.current[decorationId];
    const stageBounds = stageRef.current?.getBoundingClientRect();
    if (!decoration || !target || !stageBounds) return;

    const nextPlacement = {
      x: clamp(pixelsToPercent(parseFloat(target.style.left || "0"), stageBounds.width), -25, 100),
      y: clamp(pixelsToPercent(parseFloat(target.style.top || "0"), stageBounds.height), -25, 100),
      width: clamp(
        pixelsToPercent(parseFloat(target.style.width || "0"), stageBounds.width),
        MIN_DECORATION_SIZE_PERCENT,
        MAX_DECORATION_SIZE_PERCENT,
      ),
      rotation: wrapRotation(transientRotationBySelection.current[collageSelectionKey({ id: decorationId, kind: "decoration" })] ?? 0),
    };

    syncDecorationFrameToPercentLayout({ ...decoration, ...nextPlacement });
    onDecorationChange?.(decoration, nextPlacement);
  }

  function commitSelectionFromPixels(activeSelection: CollageSelection) {
    if (activeSelection.kind === "decoration") {
      commitDecorationFrameFromPixels(activeSelection.id);
    } else {
      commitItemFrameFromPixels(activeSelection.id);
    }
  }

  useEffect(() => {
    function handleWindowPointerMove(event: PointerEvent) {
      const gesture = activeRotationGestureRef.current;
      if (!gesture) {
        return;
      }

      const target = selectionTarget(gesture.selection);
      if (!target) {
        return;
      }

      const frameRect = target.getBoundingClientRect();
      const nextPointerAngle = pointAngleFromRectCenter(frameRect, event.clientX, event.clientY);
      const nextRotation = gesture.startRotation + (nextPointerAngle - gesture.startPointerAngle);
      transientRotationBySelection.current[collageSelectionKey(gesture.selection)] = nextRotation;
      target.style.transform = `rotate(${nextRotation}deg)`;
      moveableRef.current?.updateRect();
    }

    function handleWindowPointerEnd() {
      const gesture = activeRotationGestureRef.current;
      if (!gesture) {
        return;
      }

      activeRotationGestureRef.current = null;
      commitSelectionFromPixels(gesture.selection);
    }

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerEnd);
    window.addEventListener("pointercancel", handleWindowPointerEnd);

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerEnd);
      window.removeEventListener("pointercancel", handleWindowPointerEnd);
    };
  }, [decorations, displayLayouts, resolvedLayouts]);
  return (
    <div
      ref={stageRef}
      data-outfit-collage-stage="true"
      className={`relative overflow-hidden bg-white ${editable ? "touch-none" : ""} ${className}`.trim()}
      style={{
        aspectRatio: String(COLLAGE_STAGE_ASPECT_RATIO),
        ...(editable ? ({ "--moveable-color": "#111111" } as CSSProperties) : {}),
      }}
      onPointerDown={handleStagePointerDown}
    >
      {visibleItems.map((item, index) => {
        const layout = displayLayouts[item.id] ?? resolvedLayouts[item.id];
        const measurement = imageMeasurementByItemId[item.id];
        const contentBounds = measurement?.sourceKey === item.image_url && measurement.status === "ready"
          ? measurement.bounds ?? undefined
          : undefined;
        const mediaBox = resolveOutfitCollageMediaBox(
          layout,
          contentBounds?.aspectRatio ?? imageAspectRatioByItemId[item.id],
        );
        const isLastVisibleTile = index === visibleItems.length - 1;
        const showHiddenCount = hiddenCount > 0 && isLastVisibleTile && !editable;

        return (
          <div
            key={item.id}
            ref={(node) => {
              itemFrameRefs.current[item.id] = node;
            }}
            data-collage-item-frame="true"
            data-collage-resize-ready={item.id === selectedItemId ? selectedResizeReady : undefined}
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
              onSelectDecoration?.(null);
              onSelectItem?.(item.id);
            }}
            onClick={(event) => {
              event.stopPropagation();
              onSelectDecoration?.(null);
              onSelectItem?.(item.id);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") {
                return;
              }

              event.preventDefault();
              onSelectDecoration?.(null);
              onSelectItem?.(item.id);
            }}
          >
            <div className="relative h-full w-full overflow-hidden bg-transparent">
              {item.image_url ? (
                <div
                  className="pointer-events-none absolute overflow-hidden"
                  style={mediaBoxStyle(mediaBox)}
                >
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="absolute max-w-none"
                    style={imageStyleForContentBounds(contentBounds)}
                    onLoad={(event) => {
                      const nextAspectRatio = event.currentTarget.naturalWidth / Math.max(1, event.currentTarget.naturalHeight);
                      setImageAspectRatioByItemId((current) =>
                        nearlyEqual(current[item.id] ?? 0, nextAspectRatio, 0.001)
                          ? current
                          : {
                              ...current,
                              [item.id]: nextAspectRatio,
                            },
                      );
                    }}
                  />
                </div>
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

      {decorations.map((decoration) => {
        const measurement = decorationMeasurementById[decoration.id];
        const contentBounds = measurement?.sourceKey === decoration.image_url && measurement.status === "ready"
          ? measurement.bounds ?? undefined
          : undefined;
        const aspectRatio = contentBounds?.aspectRatio ?? decorationAspectRatioById[decoration.id] ?? 1;

        return (
          <div
            key={`decoration-${decoration.id}`}
            ref={(node) => {
              decorationFrameRefs.current[decoration.id] = node;
            }}
            data-collage-decoration-frame="true"
            data-collage-resize-ready={decoration.id === selectedDecorationId ? selectedResizeReady : undefined}
            role={editable ? "button" : undefined}
            tabIndex={editable ? 0 : -1}
            className={`absolute overflow-visible ${editable ? "cursor-move" : "pointer-events-none"}`}
            style={{
              left: `${decoration.x}%`,
              top: `${decoration.y}%`,
              width: `${decoration.width}%`,
              height: `${decorationHeightPercent(decoration.width, aspectRatio)}%`,
              transform: `rotate(${decoration.rotation}deg)`,
              transformOrigin: "center center",
              zIndex: 60 + decoration.layer_order,
            }}
            onPointerDown={(event) => {
              if (!editable) return;
              event.stopPropagation();
              onSelectItem?.(null);
              onSelectDecoration?.(decoration.id);
            }}
            onClick={(event) => {
              if (!editable) return;
              event.stopPropagation();
              onSelectItem?.(null);
              onSelectDecoration?.(decoration.id);
            }}
            onKeyDown={(event) => {
              if (!editable || (event.key !== "Enter" && event.key !== " ")) return;
              event.preventDefault();
              onSelectItem?.(null);
              onSelectDecoration?.(decoration.id);
            }}
            aria-label={editable ? `Select decoration ${decoration.name}` : undefined}
          >
            <div className="pointer-events-none relative h-full w-full overflow-hidden bg-transparent">
              <img
                src={decoration.image_url}
                alt=""
                className="absolute max-w-none select-none"
                style={imageStyleForContentBounds(contentBounds)}
                draggable={false}
                onLoad={(event) => {
                  const nextAspectRatio = event.currentTarget.naturalWidth / Math.max(1, event.currentTarget.naturalHeight);
                  setDecorationAspectRatioById((current) =>
                    nearlyEqual(current[decoration.id] ?? 0, nextAspectRatio, 0.001)
                      ? current
                      : { ...current, [decoration.id]: nextAspectRatio },
                  );
                }}
              />
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
          resizable={selectedResizeReady}
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

function mediaBoxStyle(box: ReturnType<typeof resolveOutfitCollageMediaBox>): CSSProperties {
  return {
    height: `${box.height}%`,
    left: `${box.left}%`,
    top: `${box.top}%`,
    width: `${box.width}%`,
  };
}

function imageStyleForContentBounds(bounds?: ImageContentBounds): CSSProperties {
  if (!bounds) {
    return {
      height: "100%",
      left: 0,
      objectFit: "contain",
      top: 0,
      width: "100%",
    };
  }

  return {
    height: `${100 / bounds.heightFraction}%`,
    left: `${-(bounds.leftFraction / bounds.widthFraction) * 100}%`,
    top: `${-(bounds.topFraction / bounds.heightFraction) * 100}%`,
    width: `${100 / bounds.widthFraction}%`,
  };
}

function nearlyEqual(left: number, right: number, tolerance = 0.002) {
  return Math.abs(left - right) <= tolerance;
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

function collageSelectionKey(selection: CollageSelection) {
  return `${selection.kind}:${selection.id}`;
}

function decorationHeightPercent(width: number, aspectRatio: number) {
  return (width * COLLAGE_STAGE_ASPECT_RATIO) / Math.max(aspectRatio, 0.001);
}

function resolveDecorationAspectRatio(
  decoration: OutfitDecoration,
  measurements: Record<number, ImageMeasurementState>,
  intrinsicAspectRatios: Record<number, number>,
) {
  const measurement = measurements[decoration.id];
  return (
    (measurement?.sourceKey === decoration.image_url && measurement.status === "ready"
      ? measurement.bounds?.aspectRatio
      : undefined)
    ?? intrinsicAspectRatios[decoration.id]
    ?? 1
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function wrapRotation(value: number) {
  if (value > 180) return value - 360;
  if (value < -180) return value + 360;
  return value;
}
