import { type ReactNode, type TouchEvent, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, Trash2 } from "lucide-react";
import {
  type OutfitPreviewSlide,
  resolveOutfitPreviewSlideAfterSwipe,
} from "../lib/modeledPreview";
import type { AiWorkflow } from "../lib/closet";
import { COLLAGE_STAGE_ASPECT_RATIO } from "../lib/outfitCollageRenderMath";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveConfirmationDialog } from "./primitives/PrimitiveConfirmationDialog";
import { ModeledPreviewImageEditor } from "./shared/ModeledPreviewImageEditor";

interface OutfitPreviewCarouselProps {
  flatlay: ReactNode;
  initialSlide?: OutfitPreviewSlide;
  modeledImageUrl: string | null;
  modeledWorkflow?: AiWorkflow | null;
  canDeleteModeledImage?: boolean;
  isDeletingModeledImage?: boolean;
  onDeleteModeledImage?: () => void;
  onModeledWorkflowUpdated?: (workflow: AiWorkflow) => void;
}

interface TouchOrigin {
  x: number;
  y: number;
}

export function OutfitPreviewCarousel({
  flatlay,
  initialSlide = "flatlay",
  modeledImageUrl,
  modeledWorkflow,
  canDeleteModeledImage = false,
  isDeletingModeledImage = false,
  onDeleteModeledImage,
  onModeledWorkflowUpdated,
}: OutfitPreviewCarouselProps) {
  const [activeSlide, setActiveSlide] = useState<OutfitPreviewSlide>(initialSlide);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const touchOriginRef = useRef<TouchOrigin | null>(null);
  const hasModeledImage = Boolean(modeledImageUrl);

  useEffect(() => {
    setActiveSlide(initialSlide === "modeled" && hasModeledImage ? "modeled" : "flatlay");
  }, [hasModeledImage, initialSlide]);

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (!hasModeledImage) {
      return;
    }

    const target = event.target;
    if (
      target instanceof Element
      && target.closest("[data-collage-item-frame='true'], .moveable-control-box, .moveable-control")
    ) {
      touchOriginRef.current = null;
      return;
    }

    const touch = event.touches[0];
    touchOriginRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const origin = touchOriginRef.current;
    const touch = event.changedTouches[0];
    touchOriginRef.current = null;
    if (!origin || !touch) {
      return;
    }

    setActiveSlide((currentSlide) => resolveOutfitPreviewSlideAfterSwipe({
      currentSlide,
      deltaX: touch.clientX - origin.x,
      deltaY: touch.clientY - origin.y,
      hasModeledImage,
    }));
  }

  return (
    <div
      className="bg-white"
      role="region"
      aria-roledescription="carousel"
      aria-label="Outfit flat lay and modeled preview"
    >
      <div
        className="relative isolate overflow-hidden"
        style={{ aspectRatio: String(COLLAGE_STAGE_ASPECT_RATIO) }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(${activeSlide === "flatlay" ? "0%" : "-100%"})` }}
        >
          <div className="h-full w-full shrink-0" aria-hidden={activeSlide !== "flatlay"}>
            {flatlay}
          </div>
          {modeledImageUrl ? (
            <div className="h-full w-full shrink-0 bg-white" aria-hidden={activeSlide !== "modeled"}>
              <img
                src={modeledImageUrl}
                alt="Modeled version of this outfit"
                className="h-full w-full object-contain"
              />
            </div>
          ) : null}
        </div>

        {hasModeledImage ? (
          <>
            {activeSlide === "flatlay" ? (
              <PrimitiveButton
                type="button"
                variant="outline"
                size="icon"
                className="absolute right-3 top-1/2 z-20 -translate-y-1/2 bg-background/90 shadow-lg backdrop-blur-sm"
                onClick={() => setActiveSlide("modeled")}
                aria-label="View modeled outfit"
              >
                <ChevronRight className="h-5 w-5" />
              </PrimitiveButton>
            ) : (
              <PrimitiveButton
                type="button"
                variant="outline"
                size="icon"
                className="absolute left-3 top-1/2 z-20 -translate-y-1/2 bg-background/90 shadow-lg backdrop-blur-sm"
                onClick={() => setActiveSlide("flatlay")}
                aria-label="View outfit flat lay"
              >
                <ChevronLeft className="h-5 w-5" />
              </PrimitiveButton>
            )}

            {activeSlide === "modeled" && modeledWorkflow && modeledImageUrl && onModeledWorkflowUpdated ? (
              <div className="absolute right-3 top-3 z-20 flex gap-2">
                <ModeledPreviewImageEditor
                  workflow={modeledWorkflow}
                  imageUrl={modeledImageUrl}
                  onWorkflowUpdated={onModeledWorkflowUpdated}
                  title="modeled outfit preview"
                  buttonClassName="bg-background/90 shadow-lg backdrop-blur-sm"
                />
                {canDeleteModeledImage && onDeleteModeledImage ? (
                  <PrimitiveConfirmationDialog
                    open={isDeleteConfirmationOpen}
                    onOpenChange={setIsDeleteConfirmationOpen}
                    title="Delete modeled preview?"
                    description="This permanently removes the generated image. Your saved outfit and flat lay will not be changed."
                    cancelLabel="Keep preview"
                    confirmLabel={isDeletingModeledImage ? "Deleting..." : "Delete preview"}
                    onConfirm={onDeleteModeledImage}
                  >
                    <PrimitiveButton
                      type="button"
                      variant="outline"
                      size="icon"
                      className="bg-background/90 text-destructive shadow-lg backdrop-blur-sm hover:text-destructive"
                      disabled={isDeletingModeledImage}
                      aria-label="Delete modeled outfit preview"
                    >
                      {isDeletingModeledImage
                        ? <LoaderCircle className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </PrimitiveButton>
                  </PrimitiveConfirmationDialog>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {hasModeledImage ? (
        <div className="flex items-center justify-center border-t border-border/60 bg-background px-2.5 py-2.5" aria-hidden="true">
          <div className="flex gap-1.5">
            <span className={`h-1.5 w-1.5 ${activeSlide === "flatlay" ? "bg-foreground" : "bg-foreground/25"}`} />
            <span className={`h-1.5 w-1.5 ${activeSlide === "modeled" ? "bg-foreground" : "bg-foreground/25"}`} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
