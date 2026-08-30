import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

import type { Outfit, OutfitFolder, OutfitFolderDecoration } from "../../lib/closet";
import {
  clampMagazineElement,
  type MagazineEditableElement,
  type MagazineElementLayout,
  type MagazinePageLayout,
} from "../../lib/magazineLayout";
import { resolveModeledWorkflowImageUrl } from "../../lib/modeledPreview";
import { OutfitCollageCanvas } from "../OutfitCollageCanvas";
import { PrimitiveText } from "../primitives/PrimitiveText";

export interface MagazinePageDefinition {
  key: string;
  outfit: Outfit | null;
}

export type MagazinePageSelection =
  | { element: MagazineEditableElement; kind: "element" }
  | { decorationId: number; kind: "decoration" }
  | null;

interface MagazinePageCanvasProps {
  decorations?: OutfitFolderDecoration[];
  editable?: boolean;
  folder: OutfitFolder;
  layout: MagazinePageLayout;
  onDecorationChange?: (
    decoration: OutfitFolderDecoration,
    changes: Partial<Pick<OutfitFolderDecoration, "x" | "y">>,
    commit: boolean,
  ) => void;
  onElementChange?: (element: MagazineEditableElement, changes: Partial<MagazineElementLayout>) => void;
  onSelectionChange?: (selection: MagazinePageSelection) => void;
  page: MagazinePageDefinition;
  pageNumber: number;
  selection?: MagazinePageSelection;
}

export function MagazinePageCanvas({
  decorations = [],
  editable = false,
  folder,
  layout,
  onDecorationChange,
  onElementChange,
  onSelectionChange,
  page,
  pageNumber,
  selection = null,
}: MagazinePageCanvasProps) {
  const title = layout.title!;
  const body = layout.body!;
  const image = layout.image;

  function beginElementDrag(
    event: ReactPointerEvent<HTMLElement>,
    element: MagazineEditableElement,
    elementLayout: MagazineElementLayout,
  ) {
    if (!editable) return;
    const pageElement = event.currentTarget.closest<HTMLElement>("[data-magazine-page-canvas='true']");
    if (!pageElement) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectionChange?.({ element, kind: "element" });
    const bounds = pageElement.getBoundingClientRect();
    const origin = { x: elementLayout.x, y: elementLayout.y, pointerX: event.clientX, pointerY: event.clientY };

    const handleMove = (moveEvent: PointerEvent) => {
      onElementChange?.(element, clampMagazineElement({
        ...elementLayout,
        x: origin.x + ((moveEvent.clientX - origin.pointerX) / bounds.width) * 100,
        y: origin.y + ((moveEvent.clientY - origin.pointerY) / bounds.height) * 100,
      }));
    };
    const handleEnd = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd, { once: true });
    window.addEventListener("pointercancel", handleEnd, { once: true });
  }

  function beginDecorationDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    decoration: OutfitFolderDecoration,
  ) {
    if (!editable) return;
    const pageElement = event.currentTarget.closest<HTMLElement>("[data-magazine-page-canvas='true']");
    if (!pageElement) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectionChange?.({ decorationId: decoration.id, kind: "decoration" });
    const bounds = pageElement.getBoundingClientRect();
    const origin = { x: decoration.x, y: decoration.y, pointerX: event.clientX, pointerY: event.clientY };
    let latest = { x: decoration.x, y: decoration.y };

    const handleMove = (moveEvent: PointerEvent) => {
      latest = {
        x: clamp(origin.x + ((moveEvent.clientX - origin.pointerX) / bounds.width) * 100, -25, 100),
        y: clamp(origin.y + ((moveEvent.clientY - origin.pointerY) / bounds.height) * 100, -25, 100),
      };
      onDecorationChange?.(decoration, latest, false);
    };
    const handleEnd = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
      onDecorationChange?.(decoration, latest, true);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd, { once: true });
    window.addEventListener("pointercancel", handleEnd, { once: true });
  }

  return (
    <div
      data-magazine-page-canvas="true"
      className="relative aspect-[4/5] h-full max-h-full max-w-full overflow-hidden bg-white text-black shadow-[0_28px_90px_rgba(0,0,0,0.2)]"
      onPointerDown={() => editable && onSelectionChange?.(null)}
    >
      {page.outfit && image ? (
        <MagazineElementFrame
          editable={editable}
          isSelected={selection?.kind === "element" && selection.element === "image"}
          layout={image}
          onPointerDown={(event) => beginElementDrag(event, "image", image)}
          zIndex={2}
        >
          <MagazineOutfitImage outfit={page.outfit} mode={layout.image_mode ?? "flatlay"} />
        </MagazineElementFrame>
      ) : (
        <MagazineCoverBackdrop folder={folder} />
      )}

      <MagazineElementFrame
        editable={editable}
        isSelected={selection?.kind === "element" && selection.element === "title"}
        layout={title}
        onPointerDown={(event) => beginElementDrag(event, "title", title)}
        zIndex={10}
      >
        <PrimitiveText
          as="h2"
          variant="display"
          font="serif"
          className={page.key === "cover"
            ? "text-[clamp(2.4rem,8vw,5.5rem)] leading-[0.82]"
            : "text-[clamp(1.7rem,4vw,3rem)] leading-none"}
        >
          {title.text}
        </PrimitiveText>
      </MagazineElementFrame>

      <MagazineElementFrame
        editable={editable}
        isSelected={selection?.kind === "element" && selection.element === "body"}
        layout={body}
        onPointerDown={(event) => beginElementDrag(event, "body", body)}
        zIndex={10}
      >
        <PrimitiveText as="p" variant="caption" className="line-clamp-5 opacity-75">
          {body.text}
        </PrimitiveText>
      </MagazineElementFrame>

      <PrimitiveText as="p" variant="overline" className="absolute right-[5%] top-[4%] z-10 tracking-[0.24em] opacity-60">
        {page.key === "cover" ? "Private Lookbook" : `Look ${String(pageNumber).padStart(2, "0")}`}
      </PrimitiveText>
      <PrimitiveText as="p" variant="overline" className="absolute bottom-[3%] right-[5%] z-10 opacity-60">
        {String(pageNumber + 1).padStart(2, "0")}
      </PrimitiveText>

      {decorations.map((decoration) => (
        <button
          key={decoration.id}
          type="button"
          className={`absolute block touch-none bg-transparent p-0 ${editable ? "cursor-move" : "pointer-events-none"} ${
            selection?.kind === "decoration" && selection.decorationId === decoration.id
              ? "outline outline-1 outline-offset-2 outline-black/60"
              : ""
          }`}
          style={{
            left: `${decoration.x}%`,
            top: `${decoration.y}%`,
            width: `${decoration.width}%`,
            transform: `rotate(${decoration.rotation}deg)`,
            zIndex: 30 + decoration.layer_order,
          }}
          onPointerDown={(event) => beginDecorationDrag(event, decoration)}
          aria-label={editable ? `Move ${decoration.name || "decoration"}` : undefined}
          tabIndex={editable ? 0 : -1}
        >
          <img src={decoration.image_url} alt="" className="block h-auto w-full select-none" draggable={false} />
        </button>
      ))}
    </div>
  );
}

function MagazineElementFrame({
  children,
  editable,
  isSelected,
  layout,
  onPointerDown,
  zIndex,
}: {
  children: ReactNode;
  editable: boolean;
  isSelected: boolean;
  layout: MagazineElementLayout;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  zIndex: number;
}) {
  return (
    <section
      className={`absolute touch-none ${editable ? "cursor-move" : ""} ${isSelected ? "outline outline-1 outline-offset-4 outline-black/65" : ""}`}
      style={{ left: `${layout.x}%`, top: `${layout.y}%`, width: `${layout.width}%`, zIndex }}
      onPointerDown={onPointerDown}
    >
      {children}
    </section>
  );
}

function MagazineOutfitImage({ outfit, mode }: { outfit: Outfit; mode: "flatlay" | "modeled" }) {
  const modeledImageUrl = resolveModeledWorkflowImageUrl(outfit.modeled_workflow);
  if (mode === "modeled" && modeledImageUrl) {
    return <img src={modeledImageUrl} alt={`Modeled version of ${outfit.name}`} className="aspect-[4/5] h-auto w-full object-contain" />;
  }

  return (
    <OutfitCollageCanvas
      decorations={outfit.decorations}
      items={outfit.items}
      maxVisibleItems={6}
      className="w-full"
    />
  );
}

function MagazineCoverBackdrop({ folder }: { folder: OutfitFolder }) {
  const firstModeledImage = folder.outfits
    .map((outfit) => resolveModeledWorkflowImageUrl(outfit.modeled_workflow))
    .find(Boolean);
  return firstModeledImage ? (
    <img src={firstModeledImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15 grayscale" />
  ) : null;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
