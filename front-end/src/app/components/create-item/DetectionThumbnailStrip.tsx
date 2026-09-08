import { Check } from "lucide-react";
import { OutfitDetection, titleize } from "../../lib/closet";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { DetectionPreviewImage } from "./DetectionPreview";

const stripFrameClass = "flex h-14 min-h-14 max-h-14 items-center overflow-hidden border border-border bg-card px-4 lg:-mt-20";
const stripContentViewportClass = "min-w-0 overflow-x-auto";
const stripContentClass = "flex h-full items-center gap-3";
const stripItemClass = "relative size-9 min-h-9 min-w-9 shrink-0 overflow-hidden border box-border appearance-none bg-transparent p-0 outline-none";

interface DetectionThumbnailStripProps {
  detections: OutfitDetection[];
  focusedTarget: "source" | number;
  getDetectionPreviewImageUrl?: (detection: OutfitDetection) => string | null;
  getDetectionSourceImageUrl?: (detection: OutfitDetection) => string | null;
  isDetecting: boolean;
  onSelectDetection: (detectionId: number) => void;
  onSelectSource: (index: number) => void;
  onToggleDetectionSelection: (detection: OutfitDetection) => void;
  selectedDetectionIds: number[];
  selectedSourceIndex: number;
  sourceImages: Array<{ id: string; imageUrl: string | null; label: string }>;
}

export function DetectionThumbnailStrip({
  detections,
  focusedTarget,
  getDetectionPreviewImageUrl,
  getDetectionSourceImageUrl,
  isDetecting,
  onSelectDetection,
  onSelectSource,
  onToggleDetectionSelection,
  selectedDetectionIds,
  selectedSourceIndex,
  sourceImages,
}: DetectionThumbnailStripProps) {
  function itemClass(isActive: boolean) {
    return `${stripItemClass} ${
      isActive
        ? "border-foreground ring-1 ring-inset ring-foreground"
        : "border-border"
    }`;
  }

  return (
    <div className={stripFrameClass}>
      <div className="h-full min-w-0 w-full">
        <div className={stripContentViewportClass}>
          <div className={stripContentClass}>
            {sourceImages.length > 0 ? sourceImages.map((source, index) => (
              <button
                key={source.id}
                type="button"
                onClick={() => onSelectSource(index)}
                className={itemClass(focusedTarget === "source" && selectedSourceIndex === index)}
                aria-label={`Show source photo ${index + 1}: ${source.label}`}
                title={source.label}
              >
                {source.imageUrl ? (
                  <img
                    src={source.imageUrl}
                    alt=""
                    className="block h-full w-full object-cover"
                  />
                ) : (
                  <span aria-hidden="true" className="block h-full w-full bg-muted/35" />
                )}
              </button>
            )) : (
              <div aria-hidden="true" className={`${itemClass(false)} bg-muted/35`} />
            )}

            {sourceImages.length > 0 && detections.length > 0 ? (
              <span aria-hidden="true" className="h-7 w-px shrink-0 bg-border" />
            ) : null}

            {detections.length === 0 ? (
              <p className="shrink-0 text-sm text-muted-foreground">
                {isDetecting ? "Detecting items..." : "Detected items will appear here"}
              </p>
            ) : (
              detections.map((detection) => {
                const label = detection.suggested_name?.trim() || titleize(detection.category);
                const isSelected = selectedDetectionIds.includes(detection.id);
                const hoverLabel = isSelected ? "Will add to closet" : label;
                const previewImageUrl = getDetectionPreviewImageUrl?.(detection)
                  ?? detection.cleaned_image_url
                  ?? null;

                return (
                  <span key={detection.id} className="relative size-9 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectDetection(detection.id)}
                      className={itemClass(focusedTarget === detection.id)}
                      aria-label={isSelected ? `Show ${label}. Will add to closet` : `Show ${label}`}
                      title={hoverLabel}
                    >
                      <DetectionPreviewImage
                        alt={`${label} thumbnail`}
                        cleanedImageUrl={previewImageUrl}
                        sourceImageUrl={getDetectionSourceImageUrl?.(detection) ?? null}
                      />
                      {isSelected ? (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 bg-foreground/18"
                        />
                      ) : null}
                    </button>
                    {isSelected ? (
                      <PrimitiveButton
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onToggleDetectionSelection(detection)}
                        aria-label={`Remove ${label} from items to save`}
                        className="absolute right-0.5 top-0.5 z-10 size-4 rounded-full bg-foreground p-0 text-background shadow-sm hover:bg-foreground/80 hover:text-background"
                      >
                        <Check className="size-2.5" strokeWidth={3} />
                      </PrimitiveButton>
                    ) : null}
                  </span>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
