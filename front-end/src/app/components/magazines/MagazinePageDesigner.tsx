import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, RotateCcw, RotateCw, Trash2 } from "lucide-react";

import {
  createOutfitFolderDecoration,
  destroyOutfitFolderDecoration,
  type Decoration,
  type Outfit,
  type OutfitFolder,
  type OutfitFolderDecoration,
  updateOutfitFolderDecoration,
} from "../../lib/closet";
import {
  clampMagazineElement,
  resolveMagazinePageLayout,
  type MagazineEditableElement,
  type MagazinePageLayouts,
  updateMagazinePageElement,
} from "../../lib/magazineLayout";
import { resolveModeledWorkflowImageUrl } from "../../lib/modeledPreview";
import { DecorationPickerPopover } from "../decorations/DecorationPickerPopover";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { PrimitiveText } from "../primitives/PrimitiveText";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  MagazinePageCanvas,
  type MagazinePageDefinition,
  type MagazinePageSelection,
} from "./MagazinePageCanvas";

interface MagazinePageDesignerProps {
  folder: OutfitFolder;
  magazineName: string;
  magazineNotes: string;
  onError: (message: string) => void;
  onPageLayoutsChange: (layouts: MagazinePageLayouts) => void;
  outfits: Outfit[];
  pageLayouts: MagazinePageLayouts;
}

export function MagazinePageDesigner({
  folder,
  magazineName,
  magazineNotes,
  onError,
  onPageLayoutsChange,
  outfits,
  pageLayouts,
}: MagazinePageDesignerProps) {
  const [decorations, setDecorations] = useState<OutfitFolderDecoration[]>(folder.decorations);
  const [pageIndex, setPageIndex] = useState(0);
  const [selection, setSelection] = useState<MagazinePageSelection>(null);
  const pages = useMemo<MagazinePageDefinition[]>(() => [
    { key: "cover", outfit: null },
    ...outfits.map((outfit) => ({ key: `outfit:${outfit.id}`, outfit })),
  ], [outfits]);
  const safePageIndex = Math.min(pageIndex, Math.max(0, pages.length - 1));
  const page = pages[safePageIndex];
  const pageDecorations = decorations
    .filter((decoration) => decoration.page_key === page.key)
    .sort((left, right) => left.layer_order - right.layer_order || left.id - right.id);
  const designerFolder: OutfitFolder = {
    ...folder,
    name: magazineName,
    notes: magazineNotes,
    outfits,
    outfit_ids: outfits.map((outfit) => outfit.id),
    decorations,
  };
  const layout = resolveMagazinePageLayout(page.key, pageLayouts[page.key], {
    title: page.outfit?.name ?? magazineName,
    body: page.outfit
      ? page.outfit.notes || page.outfit.items.map((item) => item.name).join(" · ")
      : magazineNotes || `${outfits.length} curated looks`,
    imageMode: page.outfit && resolveModeledWorkflowImageUrl(page.outfit.modeled_workflow) ? "modeled" : "flatlay",
  });
  const selectedDecoration = selection?.kind === "decoration"
    ? decorations.find((decoration) => decoration.id === selection.decorationId) ?? null
    : null;
  const selectedElement = selection?.kind === "element" ? layout[selection.element] : null;

  useEffect(() => {
    if (pageIndex >= pages.length) setPageIndex(Math.max(0, pages.length - 1));
    setSelection(null);
  }, [pageIndex, pages.length]);

  function turnPage(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= pages.length) return;
    setPageIndex(nextIndex);
    setSelection(null);
  }

  function changeElement(element: MagazineEditableElement, changes: Parameters<typeof updateMagazinePageElement>[3]) {
    onPageLayoutsChange(updateMagazinePageElement(pageLayouts, page.key, element, changes, layout));
  }

  function changeImageMode(imageMode: "flatlay" | "modeled") {
    onPageLayoutsChange({
      ...pageLayouts,
      [page.key]: { ...pageLayouts[page.key], image_mode: imageMode },
    });
  }

  async function addDecoration(libraryDecoration: Decoration) {
    onError("");
    try {
      const decoration = await createOutfitFolderDecoration(folder.id, {
        decorationId: libraryDecoration.id,
        pageKey: page.key,
        x: 10 + (pageDecorations.length * 7) % 42,
        y: 12 + (pageDecorations.length * 9) % 48,
        width: 18,
        layerOrder: pageDecorations.length,
      });
      setDecorations((current) => [...current, decoration]);
      setSelection({ decorationId: decoration.id, kind: "decoration" });
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to add this decoration.");
    }
  }

  function previewDecoration(
    decoration: OutfitFolderDecoration,
    changes: Partial<Pick<OutfitFolderDecoration, "x" | "y">>,
    commit: boolean,
  ) {
    setDecorations((current) => current.map((entry) => entry.id === decoration.id ? { ...entry, ...changes } : entry));
    if (commit) void persistDecoration(decoration, changes);
  }

  async function persistDecoration(
    decoration: OutfitFolderDecoration,
    changes: Partial<Pick<OutfitFolderDecoration, "x" | "y" | "width" | "rotation" | "layer_order">>,
  ) {
    const before = decorations;
    setDecorations((current) => current.map((entry) => entry.id === decoration.id ? { ...entry, ...changes } : entry));
    try {
      const saved = await updateOutfitFolderDecoration(folder.id, decoration.id, changes);
      setDecorations((current) => current.map((entry) => entry.id === saved.id ? saved : entry));
    } catch (error) {
      setDecorations(before);
      onError(error instanceof Error ? error.message : "Unable to save this decoration.");
    }
  }

  async function removeDecoration(decoration: OutfitFolderDecoration) {
    try {
      await destroyOutfitFolderDecoration(folder.id, decoration.id);
      setDecorations((current) => current.filter((entry) => entry.id !== decoration.id));
      setSelection(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to remove this decoration.");
    }
  }

  return (
    <section className="space-y-4 border-t border-border pt-8" aria-labelledby="design-pages-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PrimitiveText id="design-pages-heading" as="h2" variant="title" font="serif">Design pages</PrimitiveText>
          <PrimitiveText as="p" variant="bodySm" tone="muted" className="mt-1">
            Drag the image and text directly on the page, then refine the selected layer at right.
          </PrimitiveText>
        </div>
        <DecorationPickerPopover
          buttonLabel="Decorate this magazine page"
          buttonText="Decorate"
          onSelect={(decoration) => void addDecoration(decoration)}
        />
      </div>

      <div className="grid min-h-[46rem] gap-4 xl:grid-cols-[10rem_minmax(0,1fr)_18rem]">
        <nav className="flex gap-2 overflow-x-auto border border-border bg-card p-2 xl:flex-col xl:overflow-y-auto" aria-label="Magazine pages">
          {pages.map((entry, index) => (
            <PrimitiveButton
              key={entry.key}
              type="button"
              variant="outline"
              onClick={() => turnPage(index)}
              className={`h-auto min-w-28 justify-start whitespace-normal px-3 py-3 text-left xl:w-full ${index === safePageIndex ? "border-foreground" : ""}`}
              aria-current={index === safePageIndex ? "page" : undefined}
            >
              <span className="min-w-0">
                <PrimitiveText as="span" variant="overline" tone="muted" className="block">Page {index + 1}</PrimitiveText>
                <PrimitiveText as="span" variant="caption" className="mt-1 block truncate">{entry.outfit?.name ?? "Cover"}</PrimitiveText>
              </span>
            </PrimitiveButton>
          ))}
        </nav>

        <div className="flex min-h-0 flex-col items-center justify-center gap-3 overflow-hidden bg-stone-100 p-4 sm:p-6">
          <div className="flex w-full items-center justify-between">
            <PrimitiveButton type="button" variant="ghost" size="icon" disabled={safePageIndex === 0} onClick={() => turnPage(safePageIndex - 1)} aria-label="Previous page"><ChevronLeft /></PrimitiveButton>
            <PrimitiveText as="p" variant="overline" tone="muted">{safePageIndex + 1} / {pages.length}</PrimitiveText>
            <PrimitiveButton type="button" variant="ghost" size="icon" disabled={safePageIndex === pages.length - 1} onClick={() => turnPage(safePageIndex + 1)} aria-label="Next page"><ChevronRight /></PrimitiveButton>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <MagazinePageCanvas
              decorations={pageDecorations}
              editable
              folder={designerFolder}
              layout={layout}
              onDecorationChange={previewDecoration}
              onElementChange={changeElement}
              onSelectionChange={setSelection}
              page={page}
              pageNumber={safePageIndex}
              selection={selection}
            />
          </div>
        </div>

        <aside className="space-y-5 border border-border bg-card p-4">
          <div>
            <PrimitiveText as="p" variant="overline" tone="muted">Page settings</PrimitiveText>
            <PrimitiveText as="h3" variant="title" font="serif" className="mt-1">{page.outfit?.name ?? "Cover"}</PrimitiveText>
          </div>

          {page.outfit ? (
            <div className="space-y-2">
              <PrimitiveText as="p" variant="bodySm" tone="muted">Outfit image</PrimitiveText>
              <div className="grid grid-cols-2 gap-2">
                <PrimitiveButton type="button" variant={layout.image_mode === "flatlay" ? "default" : "outline"} onClick={() => changeImageMode("flatlay")}>Flat lay</PrimitiveButton>
                <PrimitiveButton
                  type="button"
                  variant={layout.image_mode === "modeled" ? "default" : "outline"}
                  disabled={!resolveModeledWorkflowImageUrl(page.outfit.modeled_workflow)}
                  onClick={() => changeImageMode("modeled")}
                >Model</PrimitiveButton>
              </div>
            </div>
          ) : null}

          {selection?.kind === "element" && selectedElement ? (
            <div className="space-y-3 border-t border-border pt-4">
              <PrimitiveText as="p" variant="bodySm">Edit {selection.element}</PrimitiveText>
              {selection.element === "title" ? (
                <Input value={selectedElement.text ?? ""} onChange={(event) => changeElement("title", { text: event.target.value })} aria-label="Magazine page title" />
              ) : selection.element === "body" ? (
                <Textarea value={selectedElement.text ?? ""} onChange={(event) => changeElement("body", { text: event.target.value })} className="min-h-28" aria-label="Magazine page body text" />
              ) : null}
              <div className="flex items-center gap-2">
                <PrimitiveButton type="button" variant="outline" size="icon" onClick={() => changeElement(selection.element, clampMagazineElement({ ...selectedElement, width: selectedElement.width - 4 }))} aria-label={`Make ${selection.element} smaller`}><Minimize2 /></PrimitiveButton>
                <PrimitiveButton type="button" variant="outline" size="icon" onClick={() => changeElement(selection.element, clampMagazineElement({ ...selectedElement, width: selectedElement.width + 4 }))} aria-label={`Make ${selection.element} larger`}><Maximize2 /></PrimitiveButton>
              </div>
            </div>
          ) : null}

          {selectedDecoration ? (
            <div className="space-y-3 border-t border-border pt-4">
              <PrimitiveText as="p" variant="bodySm">Edit decoration</PrimitiveText>
              <div className="flex flex-wrap gap-2">
                <PrimitiveButton type="button" variant="outline" size="icon" onClick={() => void persistDecoration(selectedDecoration, { width: clamp(selectedDecoration.width - 3, 5, 60) })} aria-label="Make decoration smaller"><Minimize2 /></PrimitiveButton>
                <PrimitiveButton type="button" variant="outline" size="icon" onClick={() => void persistDecoration(selectedDecoration, { width: clamp(selectedDecoration.width + 3, 5, 60) })} aria-label="Make decoration larger"><Maximize2 /></PrimitiveButton>
                <PrimitiveButton type="button" variant="outline" size="icon" onClick={() => void persistDecoration(selectedDecoration, { rotation: wrapRotation(selectedDecoration.rotation - 10) })} aria-label="Rotate decoration left"><RotateCcw /></PrimitiveButton>
                <PrimitiveButton type="button" variant="outline" size="icon" onClick={() => void persistDecoration(selectedDecoration, { rotation: wrapRotation(selectedDecoration.rotation + 10) })} aria-label="Rotate decoration right"><RotateCw /></PrimitiveButton>
                <PrimitiveButton type="button" variant="outline" size="icon" className="text-destructive hover:text-destructive" onClick={() => void removeDecoration(selectedDecoration)} aria-label="Delete decoration"><Trash2 /></PrimitiveButton>
              </div>
            </div>
          ) : null}

          {!selection ? (
            <PrimitiveText as="p" variant="caption" tone="muted" className="border-t border-border pt-4">
              Select the image, title, body text, or a decoration on the page to edit it.
            </PrimitiveText>
          ) : null}
        </aside>
      </div>
    </section>
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
