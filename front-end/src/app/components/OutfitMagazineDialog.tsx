import { ChangeEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  createOutfitFolderDecoration,
  destroyOutfitFolderDecoration,
  type Outfit,
  type OutfitFolder,
  type OutfitFolderDecoration,
  updateOutfitFolderDecoration,
} from "../lib/closet";
import { resolveModeledWorkflowImageUrl } from "../lib/modeledPreview";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";

interface OutfitMagazineDialogProps {
  folder: OutfitFolder | null;
  onFolderUpdated: (folder: OutfitFolder) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

interface MagazinePage {
  key: string;
  outfit: Outfit | null;
}

interface DecorationDrag {
  decorationId: number;
  latestX: number;
  latestY: number;
  originX: number;
  originY: number;
  pageHeight: number;
  pageWidth: number;
  pointerX: number;
  pointerY: number;
}

export function OutfitMagazineDialog({
  folder,
  onFolderUpdated,
  onOpenChange,
  open,
}: OutfitMagazineDialogProps) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [decorations, setDecorations] = useState<OutfitFolderDecoration[]>([]);
  const [selectedDecorationId, setSelectedDecorationId] = useState<number | null>(null);
  const [isDecorating, setIsDecorating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!folder || !open) return;
    setPageIndex(0);
    setDirection(1);
    setDecorations(folder.decorations);
    setSelectedDecorationId(null);
    setIsDecorating(false);
    setErrorMessage("");
  }, [folder?.id, open]);

  if (!folder) return null;

  const pages: MagazinePage[] = [
    { key: "cover", outfit: null },
    ...folder.outfits.map((outfit) => ({ key: `outfit:${outfit.id}`, outfit })),
  ];
  const safePageIndex = Math.min(pageIndex, Math.max(0, pages.length - 1));
  const page = pages[safePageIndex];
  const pageDecorations = decorations
    .filter((decoration) => decoration.page_key === page.key)
    .sort((left, right) => left.layer_order - right.layer_order || left.id - right.id);
  const selectedDecoration = decorations.find((decoration) => decoration.id === selectedDecorationId) ?? null;

  function syncFolder(nextDecorations: OutfitFolderDecoration[]) {
    setDecorations(nextDecorations);
    onFolderUpdated({ ...folder!, decorations: nextDecorations });
  }

  function turnPage(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= pages.length) return;
    setDirection(nextIndex > safePageIndex ? 1 : -1);
    setPageIndex(nextIndex);
    setSelectedDecorationId(null);
  }

  async function handleClipArtUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    setIsUploading(true);
    setErrorMessage("");
    try {
      let nextDecorations = decorations;
      for (const [index, file] of files.entries()) {
        const decoration = await createOutfitFolderDecoration(folder!.id, {
          file,
          pageKey: page.key,
          x: 8 + ((pageDecorations.length + index) * 7) % 42,
          y: 8 + ((pageDecorations.length + index) * 9) % 48,
          width: 20,
          layerOrder: pageDecorations.length + index,
        });
        nextDecorations = [...nextDecorations, decoration];
        setSelectedDecorationId(decoration.id);
      }
      syncFolder(nextDecorations);
      setIsDecorating(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to add this clip art.");
    } finally {
      setIsUploading(false);
    }
  }

  async function persistDecoration(
    decoration: OutfitFolderDecoration,
    changes: Partial<Pick<OutfitFolderDecoration, "x" | "y" | "width" | "rotation" | "layer_order">>,
  ) {
    const optimistic = { ...decoration, ...changes };
    const optimisticDecorations = decorations.map((entry) => entry.id === decoration.id ? optimistic : entry);
    syncFolder(optimisticDecorations);

    try {
      const saved = await updateOutfitFolderDecoration(folder!.id, decoration.id, changes);
      syncFolder(optimisticDecorations.map((entry) => entry.id === saved.id ? saved : entry));
    } catch (error) {
      syncFolder(decorations);
      setErrorMessage(error instanceof Error ? error.message : "Unable to save this decoration.");
    }
  }

  async function deleteDecoration(decoration: OutfitFolderDecoration) {
    setErrorMessage("");
    try {
      await destroyOutfitFolderDecoration(folder!.id, decoration.id);
      const nextDecorations = decorations.filter((entry) => entry.id !== decoration.id);
      syncFolder(nextDecorations);
      setSelectedDecorationId(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to remove this decoration.");
    }
  }

  function beginDecorationDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    decoration: OutfitFolderDecoration,
  ) {
    if (!isDecorating || !pageRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedDecorationId(decoration.id);

    const pageBounds = pageRef.current.getBoundingClientRect();
    const drag: DecorationDrag = {
      decorationId: decoration.id,
      latestX: decoration.x,
      latestY: decoration.y,
      originX: decoration.x,
      originY: decoration.y,
      pageHeight: pageBounds.height,
      pageWidth: pageBounds.width,
      pointerX: event.clientX,
      pointerY: event.clientY,
    };

    const handleMove = (moveEvent: PointerEvent) => {
      drag.latestX = clamp(drag.originX + ((moveEvent.clientX - drag.pointerX) / drag.pageWidth) * 100, -25, 100);
      drag.latestY = clamp(drag.originY + ((moveEvent.clientY - drag.pointerY) / drag.pageHeight) * 100, -25, 100);
      setDecorations((current) => current.map((entry) => (
        entry.id === drag.decorationId ? { ...entry, x: drag.latestX, y: drag.latestY } : entry
      )));
    };

    const handleEnd = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
      void persistDecoration(decoration, { x: drag.latestX, y: drag.latestY });
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd, { once: true });
    window.addEventListener("pointercancel", handleEnd, { once: true });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[96vh] max-w-[96vw] grid-rows-[auto_1fr] overflow-hidden rounded-none border-0 bg-[#191714] p-0 text-white">
        <DialogHeader className="border-b border-white/15 px-5 py-4 pr-14">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <DialogTitle asChild>
                <PrimitiveText as="h2" variant="display" font="serif" className="text-2xl text-white">
                  {folder.name}
                </PrimitiveText>
              </DialogTitle>
              <DialogDescription asChild>
                <PrimitiveText as="p" variant="bodySm" className="text-white/60">
                  Magazine mode · {pages.length} {pages.length === 1 ? "page" : "pages"}
                </PrimitiveText>
              </DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(event) => void handleClipArtUpload(event)}
              />
              <PrimitiveButton
                type="button"
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => setIsDecorating((current) => !current)}
                aria-pressed={isDecorating}
              >
                <Sparkles />
                {isDecorating ? "Done decorating" : "Decorate"}
              </PrimitiveButton>
              {isDecorating ? (
                <PrimitiveButton
                  type="button"
                  variant="outline"
                  className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  disabled={isUploading}
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <ImagePlus />
                  {isUploading ? "Adding…" : "Add clip art"}
                </PrimitiveButton>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <div className="relative flex min-h-0 flex-col items-center justify-center gap-3 overflow-hidden px-4 py-4">
          {errorMessage ? (
            <div className="absolute left-1/2 top-3 z-50 -translate-x-1/2 border border-red-300/50 bg-red-950/90 px-4 py-2 text-sm text-white">
              {errorMessage}
            </div>
          ) : null}

          {isDecorating && selectedDecoration ? (
            <div className="z-40 flex items-center gap-1 border border-white/20 bg-black/60 p-1 backdrop-blur">
              <PrimitiveButton type="button" variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" onClick={() => void persistDecoration(selectedDecoration, { width: clamp(selectedDecoration.width - 3, 5, 60) })} aria-label="Make clip art smaller"><Minimize2 /></PrimitiveButton>
              <PrimitiveButton type="button" variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" onClick={() => void persistDecoration(selectedDecoration, { width: clamp(selectedDecoration.width + 3, 5, 60) })} aria-label="Make clip art larger"><Maximize2 /></PrimitiveButton>
              <PrimitiveButton type="button" variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" onClick={() => void persistDecoration(selectedDecoration, { rotation: wrapRotation(selectedDecoration.rotation - 10) })} aria-label="Rotate clip art left"><RotateCcw /></PrimitiveButton>
              <PrimitiveButton type="button" variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" onClick={() => void persistDecoration(selectedDecoration, { rotation: wrapRotation(selectedDecoration.rotation + 10) })} aria-label="Rotate clip art right"><RotateCw /></PrimitiveButton>
              <PrimitiveButton type="button" variant="ghost" size="icon" className="text-red-300 hover:bg-white/10 hover:text-red-200" onClick={() => void deleteDecoration(selectedDecoration)} aria-label="Delete clip art"><Trash2 /></PrimitiveButton>
            </div>
          ) : (
            <div className="h-10" aria-hidden="true" />
          )}

          <div className="flex min-h-0 w-full flex-1 items-center justify-center gap-3">
            <PrimitiveButton
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-white hover:bg-white/10 hover:text-white"
              disabled={safePageIndex === 0}
              onClick={() => turnPage(safePageIndex - 1)}
              aria-label="Previous magazine page"
            ><ChevronLeft className="h-6 w-6" /></PrimitiveButton>

            <div className="flex h-full max-h-[72vh] min-h-0 items-center justify-center [perspective:1400px]">
              <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div
                  key={page.key}
                  custom={direction}
                  initial={{ opacity: 0, rotateY: direction > 0 ? 18 : -18, x: direction > 0 ? 30 : -30 }}
                  animate={{ opacity: 1, rotateY: 0, x: 0 }}
                  exit={{ opacity: 0, rotateY: direction > 0 ? -18 : 18, x: direction > 0 ? -30 : 30 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  className="h-full max-w-full origin-center"
                >
                  <div
                    ref={pageRef}
                    className="relative aspect-[4/5] h-full max-w-full overflow-hidden bg-white text-black shadow-[0_28px_90px_rgba(0,0,0,0.5)]"
                    onPointerDown={() => setSelectedDecorationId(null)}
                  >
                    {page.outfit ? (
                      <OutfitMagazinePage outfit={page.outfit} pageNumber={safePageIndex} />
                    ) : (
                      <MagazineCover folder={folder} />
                    )}

                    {pageDecorations.map((decoration) => (
                      <button
                        key={decoration.id}
                        type="button"
                        className={`absolute block touch-none bg-transparent p-0 ${isDecorating ? "cursor-move" : "pointer-events-none"} ${selectedDecorationId === decoration.id ? "outline outline-1 outline-offset-2 outline-black/55" : ""}`}
                        style={{
                          left: `${decoration.x}%`,
                          top: `${decoration.y}%`,
                          width: `${decoration.width}%`,
                          transform: `rotate(${decoration.rotation}deg)`,
                          zIndex: 30 + decoration.layer_order,
                        }}
                        onPointerDown={(event) => beginDecorationDrag(event, decoration)}
                        aria-label="Move clip art"
                      >
                        <img src={decoration.image_url} alt="" className="block h-auto w-full select-none" draggable={false} />
                      </button>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <PrimitiveButton
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-white hover:bg-white/10 hover:text-white"
              disabled={safePageIndex === pages.length - 1}
              onClick={() => turnPage(safePageIndex + 1)}
              aria-label="Next magazine page"
            ><ChevronRight className="h-6 w-6" /></PrimitiveButton>
          </div>

          <div className="flex items-center gap-3 text-sm text-white/65">
            <BookOpen className="h-4 w-4" />
            <span>{safePageIndex + 1} / {pages.length}</span>
            <div className="flex gap-1.5" aria-label="Magazine pages">
              {pages.map((magazinePage, index) => (
                <button
                  key={magazinePage.key}
                  type="button"
                  className={`h-1.5 w-1.5 rounded-full ${index === safePageIndex ? "bg-white" : "bg-white/25"}`}
                  onClick={() => turnPage(index)}
                  aria-label={`Open page ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MagazineCover({ folder }: { folder: OutfitFolder }) {
  const firstModeledImage = folder.outfits
    .map((outfit) => resolveModeledWorkflowImageUrl(outfit.modeled_workflow))
    .find(Boolean);

  return (
    <div className="relative flex h-full flex-col justify-between p-[9%]">
      {firstModeledImage ? (
        <img src={firstModeledImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 grayscale" />
      ) : null}
      <div className="relative border-t border-current/35 pt-3">
        <PrimitiveText as="p" variant="overline" className="tracking-[0.32em]">Private Lookbook</PrimitiveText>
      </div>
      <div className="relative">
        <PrimitiveText as="h2" variant="display" font="serif" className="text-[clamp(2.4rem,8vw,5.5rem)] leading-[0.82]">
          {folder.name}
        </PrimitiveText>
        {folder.occasion ? (
          <PrimitiveText as="p" variant="title" className="mt-6 max-w-[75%]">{folder.occasion}</PrimitiveText>
        ) : null}
      </div>
      <div className="relative flex items-end justify-between gap-8 border-b border-current/35 pb-3">
        <PrimitiveText as="p" variant="bodySm" className="max-w-[70%] line-clamp-4">
          {folder.notes || `${folder.outfits.length} curated looks`}
        </PrimitiveText>
        <PrimitiveText as="p" variant="overline">No. 01</PrimitiveText>
      </div>
    </div>
  );
}

function OutfitMagazinePage({
  outfit,
  pageNumber,
}: {
  outfit: Outfit;
  pageNumber: number;
}) {
  const modeledImageUrl = resolveModeledWorkflowImageUrl(outfit.modeled_workflow);

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] gap-[3%] p-[6%]">
      <div className="flex items-start justify-between border-b border-current/25 pb-2">
        <div>
          <PrimitiveText as="p" variant="overline" className="tracking-[0.24em]">Look {String(pageNumber).padStart(2, "0")}</PrimitiveText>
          <PrimitiveText as="h2" variant="display" font="serif" className="mt-1 text-[clamp(1.7rem,4vw,3rem)] leading-none">{outfit.name}</PrimitiveText>
        </div>
        <PrimitiveText as="p" variant="caption" className="max-w-[34%] text-right uppercase tracking-[0.14em]">
          {outfit.tags?.slice(0, 3).join(" · ") || `${outfit.items.length} pieces`}
        </PrimitiveText>
      </div>

      <div className="relative min-h-0 overflow-hidden">
        {modeledImageUrl ? (
          <img
            src={modeledImageUrl}
            alt={`Modeled version of ${outfit.name}`}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center border border-current/20 bg-black/[0.025] text-center">
            <UserRound className="mb-4 h-16 w-16 stroke-1 opacity-35" />
            <PrimitiveText as="p" variant="title" font="serif">Model preview coming soon</PrimitiveText>
            <PrimitiveText as="p" variant="caption" className="mt-2 max-w-[55%] opacity-60">
              Generate a modeled image from Model view to complete this page.
            </PrimitiveText>
          </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-6 border-t border-current/25 pt-2">
        <PrimitiveText as="p" variant="caption" className="max-w-[72%] line-clamp-3 opacity-70">
          {outfit.notes || outfit.items.map((item) => item.name).join(" · ")}
        </PrimitiveText>
        <PrimitiveText as="p" variant="overline">{String(pageNumber + 1).padStart(2, "0")}</PrimitiveText>
      </div>
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
