import { PointerEvent as ReactPointerEvent } from "react";
import { Maximize2, Minimize2, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import type { Decoration, OutfitDecoration } from "../../lib/closet";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { DecorationPickerPopover } from "./DecorationPickerPopover";

interface OutfitDecorationLayerProps {
  editable?: boolean;
  onAdd?: (decoration: Decoration) => void;
  onChange?: (placement: OutfitDecoration, changes: Partial<OutfitDecoration>) => void;
  onDelete?: (placement: OutfitDecoration) => void;
  onSelectionChange?: (placementId: number | null) => void;
  placements?: OutfitDecoration[];
  selectedPlacementId?: number | null;
}

export function OutfitDecorationLayer({
  editable = false,
  onAdd,
  onChange,
  onDelete,
  onSelectionChange,
  placements = [],
  selectedPlacementId = null,
}: OutfitDecorationLayerProps) {
  const selectedPlacement = placements.find((placement) => placement.id === selectedPlacementId) ?? null;

  function beginDrag(event: ReactPointerEvent<HTMLButtonElement>, placement: OutfitDecoration) {
    if (!editable) return;
    const stage = event.currentTarget.closest<HTMLElement>("[data-outfit-collage-stage='true']");
    if (!stage) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectionChange?.(placement.id);
    const bounds = stage.getBoundingClientRect();
    const origin = { x: placement.x, y: placement.y, pointerX: event.clientX, pointerY: event.clientY };
    let latestX = placement.x;
    let latestY = placement.y;

    const handleMove = (moveEvent: PointerEvent) => {
      latestX = clamp(origin.x + ((moveEvent.clientX - origin.pointerX) / bounds.width) * 100, -25, 100);
      latestY = clamp(origin.y + ((moveEvent.clientY - origin.pointerY) / bounds.height) * 100, -25, 100);
      const element = stage.querySelector<HTMLElement>(`[data-outfit-decoration-id='${placement.id}']`);
      if (element) {
        element.style.left = `${latestX}%`;
        element.style.top = `${latestY}%`;
      }
    };
    const handleEnd = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
      onChange?.(placement, { x: latestX, y: latestY });
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd, { once: true });
    window.addEventListener("pointercancel", handleEnd, { once: true });
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[80]" aria-label={editable ? "Outfit decorations" : undefined}>
      {placements.map((placement) => (
        <button
          key={placement.id}
          type="button"
          data-outfit-decoration-id={placement.id}
          className={`absolute block touch-none bg-transparent p-0 ${editable ? "pointer-events-auto cursor-move" : "pointer-events-none"} ${selectedPlacementId === placement.id ? "outline outline-1 outline-offset-2 outline-foreground/70" : ""}`}
          style={{ left: `${placement.x}%`, top: `${placement.y}%`, width: `${placement.width}%`, transform: `rotate(${placement.rotation}deg)`, zIndex: placement.layer_order + 1 }}
          onPointerDown={(event) => beginDrag(event, placement)}
          onClick={(event) => { event.stopPropagation(); onSelectionChange?.(placement.id); }}
          aria-label={`Move ${placement.name}`}
          tabIndex={editable ? 0 : -1}
        >
          <img src={placement.image_url} alt="" className="block h-auto w-full select-none" draggable={false} />
        </button>
      ))}

      {editable ? (
        <div className="pointer-events-auto absolute bottom-3 right-3 z-50 flex items-center gap-1 border border-border bg-background/95 p-1 shadow-lg backdrop-blur">
          {selectedPlacement ? (
            <>
              <PrimitiveButton type="button" variant="ghost" size="icon" onClick={() => onChange?.(selectedPlacement, { width: clamp(selectedPlacement.width - 3, 5, 60) })} aria-label="Make decoration smaller"><Minimize2 /></PrimitiveButton>
              <PrimitiveButton type="button" variant="ghost" size="icon" onClick={() => onChange?.(selectedPlacement, { width: clamp(selectedPlacement.width + 3, 5, 60) })} aria-label="Make decoration larger"><Maximize2 /></PrimitiveButton>
              <PrimitiveButton type="button" variant="ghost" size="icon" onClick={() => onChange?.(selectedPlacement, { rotation: wrapRotation(selectedPlacement.rotation - 10) })} aria-label="Rotate decoration left"><RotateCcw /></PrimitiveButton>
              <PrimitiveButton type="button" variant="ghost" size="icon" onClick={() => onChange?.(selectedPlacement, { rotation: wrapRotation(selectedPlacement.rotation + 10) })} aria-label="Rotate decoration right"><RotateCw /></PrimitiveButton>
              <PrimitiveButton type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onDelete?.(selectedPlacement)} aria-label="Remove decoration"><Trash2 /></PrimitiveButton>
            </>
          ) : null}
          {onAdd ? <DecorationPickerPopover side="left" onSelect={onAdd} buttonLabel="Add decoration to flat lay" /> : null}
        </div>
      ) : null}
    </div>
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
