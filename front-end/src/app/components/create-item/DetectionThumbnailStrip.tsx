import { Check } from "lucide-react";
import { OutfitDetection, preferredDetectionBox, titleize } from "../../lib/closet";
import { DetectionPreviewImage } from "./DetectionPreview";

const stripFrameClass = "flex h-14 min-h-14 max-h-14 items-center overflow-hidden border border-border bg-card px-4 lg:-mt-20";
const stripShellClass = "grid h-full w-full grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-3";
const stripContentViewportClass = "min-w-0 overflow-x-auto";
const stripContentClass = "flex h-full items-center gap-3";
const stripItemClass = "relative size-9 min-h-9 min-w-9 shrink-0 overflow-hidden border box-border appearance-none bg-transparent p-0 outline-none";

interface DetectionThumbnailStripProps {
  detections: OutfitDetection[];
  focusedTarget: "source" | number;
  isDetecting: boolean;
  onSelectDetection: (detectionId: number) => void;
  onSelectSource: () => void;
  selectedDetectionIds: number[];
  sourceImageUrl: string | null;
}

export function DetectionThumbnailStrip({
  detections,
  focusedTarget,
  isDetecting,
  onSelectDetection,
  onSelectSource,
  selectedDetectionIds,
  sourceImageUrl,
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
      <div className={stripShellClass}>
        {sourceImageUrl ? (
          <button
            type="button"
            onClick={onSelectSource}
            className={itemClass(focusedTarget === "source")}
            aria-label="Show original image"
            title="Original image"
          >
            <img
              src={sourceImageUrl}
              alt="Original source thumbnail"
              className="block h-full w-full object-cover"
            />
          </button>
        ) : null}
        {sourceImageUrl ? null : (
          <div
            aria-hidden="true"
            className={`${itemClass(false)} bg-muted/35`}
          />
        )}

        <div className={stripContentViewportClass}>
          <div className={stripContentClass}>
            {detections.length === 0 ? (
              <p className="shrink-0 text-sm text-muted-foreground">
                {isDetecting ? "Detecting items..." : "Detected items will appear here"}
              </p>
            ) : (
              detections.map((detection) => {
                const previewBox = preferredDetectionBox(detection);
                const label = detection.suggested_name?.trim() || titleize(detection.category);
                const isSelected = selectedDetectionIds.includes(detection.id);
                const hoverLabel = isSelected ? "Will add to closet" : label;

                return (
                  <button
                    key={detection.id}
                    type="button"
                    onClick={() => onSelectDetection(detection.id)}
                    className={itemClass(focusedTarget === detection.id)}
                    aria-label={isSelected ? `Show ${label}. Will add to closet` : `Show ${label}`}
                    title={hoverLabel}
                  >
                    <DetectionPreviewImage
                      alt={`${label} thumbnail`}
                      cleanedImageUrl={detection.cleaned_image_url ?? null}
                      cropBox={previewBox}
                      sourceImageUrl={sourceImageUrl}
                      variant="thumbnail"
                    />
                    {isSelected ? (
                      <>
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 bg-foreground/18"
                        />
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute top-0.5 right-0.5 inline-flex size-4 items-center justify-center rounded-full bg-foreground text-background shadow-sm"
                        >
                          <Check className="size-2.5" strokeWidth={3} />
                        </span>
                      </>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
