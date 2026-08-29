import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { UserRound } from "lucide-react";

import type { Outfit } from "../lib/closet";
import { resolveOutfitGalleryModelPreview } from "../lib/modeledPreview";
import { OutfitCollageCanvas } from "./OutfitCollageCanvas";
import { PrimitiveText } from "./primitives/PrimitiveText";

export type OutfitGalleryPreviewView = "flatlay" | "modeled";

interface OutfitGalleryPreviewProps {
  outfit: Outfit;
  view: OutfitGalleryPreviewView;
}

export function OutfitGalleryPreview({ outfit, view }: OutfitGalleryPreviewProps) {
  const prefersReducedMotion = useReducedMotion();
  const modeledPreview = resolveOutfitGalleryModelPreview(outfit.modeled_workflow);
  const motionState = prefersReducedMotion
    ? { opacity: 1, scale: 1, y: 0 }
    : { opacity: 0, scale: 0.985, y: 6 };

  return (
    <div
      className="relative mx-auto aspect-[4/5] w-full max-w-[15.5rem] overflow-hidden bg-white"
      role="region"
      aria-label={`${outfit.name} ${view === "modeled" ? "modeled" : "flat lay"} preview`}
    >
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={view}
          className="absolute inset-0"
          initial={motionState}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={motionState}
          transition={prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {view === "modeled" ? (
            modeledPreview.kind === "image" ? (
              <img
                src={modeledPreview.imageUrl}
                alt={`Modeled version of ${outfit.name}`}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden border border-border/70 bg-stone-100 px-6 text-center">
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/80 to-transparent" aria-hidden="true" />
                <UserRound className="relative mb-5 h-16 w-16 stroke-[1.1] text-muted-foreground/55" aria-hidden="true" />
                <PrimitiveText as="p" variant="title" font="serif" className="relative mb-2">
                  Model preview
                </PrimitiveText>
                <PrimitiveText as="p" variant="caption" tone="muted" className="relative max-w-40">
                  No modeled version has been created yet.
                </PrimitiveText>
              </div>
            )
          ) : (
            <OutfitCollageCanvas
              decorations={outfit.decorations}
              items={outfit.items}
              maxVisibleItems={6}
              className="h-full w-full"
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
