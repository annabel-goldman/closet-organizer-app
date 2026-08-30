import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { fetchOutfitFolder, type OutfitFolder } from "../lib/closet";
import { resolveMagazinePageLayout } from "../lib/magazineLayout";
import { resolveModeledWorkflowImageUrl } from "../lib/modeledPreview";
import { navigateTo } from "../lib/routes";
import {
  MagazinePageCanvas,
  type MagazinePageDefinition,
} from "./magazines/MagazinePageCanvas";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";

interface MagazineReaderPageProps {
  magazineId: number;
}

export function MagazineReaderPage({ magazineId }: MagazineReaderPageProps) {
  const [folder, setFolder] = useState<OutfitFolder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setErrorMessage("");

    fetchOutfitFolder(magazineId, controller.signal)
      .then((nextFolder) => {
        setFolder(nextFolder);
        setPageIndex(0);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setErrorMessage(error instanceof Error ? error.message : "Unable to load this magazine.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [magazineId]);

  const pageCount = (folder?.outfits.length ?? 0) + 1;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setDirection(-1);
        setPageIndex((current) => Math.max(0, current - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setDirection(1);
        setPageIndex((current) => Math.min(pageCount - 1, current + 1));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pageCount]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#191714] text-white" role="status">
        <PrimitiveText className="text-white/65">Opening magazine…</PrimitiveText>
      </main>
    );
  }

  if (!folder) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#191714] px-6 text-center text-white">
        <PrimitiveText as="h1" variant="display" font="serif" className="text-white">
          Magazine unavailable
        </PrimitiveText>
        <PrimitiveText as="p" className="mt-3 text-white/65">
          {errorMessage || "This magazine could not be found."}
        </PrimitiveText>
        <PrimitiveButton
          type="button"
          variant="outline"
          className="mt-6 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
          onClick={() => navigateTo("/outfits?view=magazines")}
        >
          Back to magazines
        </PrimitiveButton>
      </main>
    );
  }

  const pages: MagazinePageDefinition[] = [
    { key: "cover", outfit: null },
    ...folder.outfits.map((outfit) => ({ key: `outfit:${outfit.id}`, outfit })),
  ];
  const safePageIndex = Math.min(pageIndex, pages.length - 1);
  const page = pages[safePageIndex];
  const layout = resolveMagazinePageLayout(page.key, folder.page_layouts[page.key], {
    title: page.outfit?.name ?? folder.name,
    body: page.outfit
      ? page.outfit.notes || page.outfit.items.map((item) => item.name).join(" · ")
      : folder.notes || `${folder.outfits.length} curated looks`,
    imageMode: page.outfit && resolveModeledWorkflowImageUrl(page.outfit.modeled_workflow) ? "modeled" : "flatlay",
  });
  const decorations = folder.decorations
    .filter((decoration) => decoration.page_key === page.key)
    .sort((left, right) => left.layer_order - right.layer_order || left.id - right.id);

  function turnPage(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= pages.length || nextIndex === safePageIndex) return;
    setDirection(nextIndex > safePageIndex ? 1 : -1);
    setPageIndex(nextIndex);
  }

  return (
    <main className="group/reader relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#191714] p-3 sm:p-6">
      <div className="group/editor absolute inset-x-0 top-0 z-40 h-24">
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 to-transparent opacity-0 transition-opacity duration-200 group-hover/editor:opacity-100 group-focus-within/editor:opacity-100" />
        <PrimitiveButton
          type="button"
          variant="outline"
          className="absolute right-4 top-4 translate-y-[-140%] border-white/40 bg-black/45 text-white opacity-0 backdrop-blur-sm transition-all duration-200 hover:bg-black/70 hover:text-white group-hover/editor:translate-y-0 group-hover/editor:opacity-100 group-focus-within/editor:translate-y-0 group-focus-within/editor:opacity-100 sm:right-6 sm:top-6"
          onClick={() => navigateTo(`/magazines/${folder.id}/edit`)}
        >
          <Pencil /> Edit magazine
        </PrimitiveButton>
      </div>

      <PrimitiveButton
        type="button"
        variant="outline"
        size="icon"
        className="absolute left-3 z-30 border-white/30 bg-black/35 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/65 hover:text-white group-hover/reader:opacity-100 group-focus-within/reader:opacity-100 sm:left-6"
        disabled={safePageIndex === 0}
        onClick={() => turnPage(safePageIndex - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft />
      </PrimitiveButton>

      <div className="relative flex h-full max-h-full w-full items-center justify-center [perspective:1600px]">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={page.key}
            custom={direction}
            initial={{ opacity: 0, rotateY: direction > 0 ? 8 : -8, x: direction > 0 ? 46 : -46 }}
            animate={{ opacity: 1, rotateY: 0, x: 0 }}
            exit={{ opacity: 0, rotateY: direction > 0 ? -8 : 8, x: direction > 0 ? -46 : 46 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <MagazinePageCanvas
              decorations={decorations}
              folder={folder}
              layout={layout}
              page={page}
              pageNumber={safePageIndex}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <PrimitiveButton
        type="button"
        variant="outline"
        size="icon"
        className="absolute right-3 z-30 border-white/30 bg-black/35 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/65 hover:text-white group-hover/reader:opacity-100 group-focus-within/reader:opacity-100 sm:right-6"
        disabled={safePageIndex === pages.length - 1}
        onClick={() => turnPage(safePageIndex + 1)}
        aria-label="Next page"
      >
        <ChevronRight />
      </PrimitiveButton>

      <nav className="absolute bottom-4 z-30 flex gap-2 rounded-full bg-black/35 px-3 py-2 opacity-0 backdrop-blur-sm transition-opacity group-hover/reader:opacity-100 group-focus-within/reader:opacity-100" aria-label="Magazine pages">
        {pages.map((entry, index) => (
          <button
            key={entry.key}
            type="button"
            className={`h-2.5 w-2.5 rounded-full border border-white/60 transition-colors ${index === safePageIndex ? "bg-white" : "bg-transparent hover:bg-white/45"}`}
            onClick={() => turnPage(index)}
            aria-label={`Open page ${index + 1}`}
            aria-current={index === safePageIndex ? "page" : undefined}
          />
        ))}
      </nav>
    </main>
  );
}
