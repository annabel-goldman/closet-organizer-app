import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Check, PencilLine, Sparkles } from "lucide-react";
import {
  ClothingItemFormValues,
  formatTagLabel,
  OutfitDetection,
  OutfitDetectionBoundingBox,
  preferredDetectionBox,
  titleize,
} from "../../lib/closet";
import { AiCleanImageButton } from "../AiCleanImageButton";
import { ItemMetadataFields } from "../ItemMetadataFields";

interface DetectionReviewCardProps {
  cleanImageError?: string;
  cleanedImageUrl: string | null;
  detection: OutfitDetection;
  draftValues: ClothingItemFormValues;
  index: number;
  isCleaningImage: boolean;
  isEditing: boolean;
  isSelected: boolean;
  onCleanImage: () => void;
  onDraftChange: (nextValues: ClothingItemFormValues) => void;
  onToggle: () => void;
  onToggleEdit: () => void;
  sourceImageUrl: string | null;
}

export function DetectionReviewCard({
  cleanImageError,
  cleanedImageUrl,
  detection,
  draftValues,
  index,
  isCleaningImage,
  isEditing,
  isSelected,
  onCleanImage,
  onDraftChange,
  onToggle,
  onToggleEdit,
  sourceImageUrl,
}: DetectionReviewCardProps) {
  const confidenceLabel =
    detection.confidence == null
      ? "Confidence unavailable"
      : `${Math.round(detection.confidence * 100)}% detection confidence`;
  const suggestedName = detection.suggested_name?.trim() || titleize(detection.category);
  const previewBox = preferredDetectionBox(detection);
  const canSave = Boolean(previewBox);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      className={`border bg-card p-5 space-y-4 transition-colors ${
        isSelected ? "border-foreground" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="uppercase tracking-[0.2em] text-xs text-muted-foreground mb-2">
            {formatTagLabel(detection.category)}
          </p>
          <h3>{suggestedName}</h3>
        </div>
        <div className="h-10 w-10 border border-border rounded-full flex items-center justify-center bg-muted">
          <Sparkles className="w-4 h-4" />
        </div>
      </div>

      <p className="text-sm text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
        {confidenceLabel}
      </p>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {cleanedImageUrl ? "AI-Cleaned Preview" : "Automated Crop Preview"}
        </p>
        <AiCleanImageButton
          disabled={!cleanedImageUrl && !previewBox}
          isLoading={isCleaningImage}
          onClick={onCleanImage}
        />
      </div>

      {cleanedImageUrl ? (
        <div className="overflow-hidden border border-border bg-muted">
          <img
            src={cleanedImageUrl}
            alt={`${suggestedName} AI cleaned preview`}
            className="block w-full h-auto object-contain"
          />
        </div>
      ) : sourceImageUrl && previewBox ? (
        <div className="space-y-3">
          <DetectionCropPreview sourceImageUrl={sourceImageUrl} cropBox={previewBox} />
        </div>
      ) : (
        <div className="border border-dashed border-border p-4 text-sm text-muted-foreground">
          No crop preview is available for this detection yet.
        </div>
      )}

      {cleanImageError && (
        <div className="border border-destructive/20 bg-destructive/5 px-3 py-3 text-sm">
          {cleanImageError}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 text-sm" style={{ fontFamily: "Outfit, sans-serif" }}>
        <DetectionDetail label="Color" value={detection.details.dominant_color} />
        <DetectionDetail label="Material" value={detection.details.material_guess} />
        <DetectionDetail label="Style" value={detection.details.style_guess} />
        <DetectionDetail label="Notes" value={detection.details.notes} />
      </div>

      {isEditing && (
        <div className="space-y-5 border-t border-border pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ItemMetadataFields values={draftValues} onChange={onDraftChange} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={onToggleEdit}
          className="inline-flex items-center gap-2 px-4 py-2 border border-border hover:border-foreground transition-colors"
        >
          <PencilLine className="w-4 h-4" />
          {isEditing ? "Done editing" : "Edit"}
        </button>
        <button
          type="button"
          onClick={onToggle}
          disabled={!canSave}
          className={`inline-flex items-center gap-2 px-4 py-2 border transition-colors disabled:opacity-50 ${
            isSelected
              ? "border-foreground bg-foreground text-background"
              : "border-border hover:border-foreground"
          }`}
        >
          <Check className="w-4 h-4" />
          {isSelected ? "Will save to closet" : canSave ? "Add to closet" : "Preview unavailable"}
        </button>
      </div>
    </motion.div>
  );
}

function DetectionCropPreview({
  cropBox,
  sourceImageUrl,
}: {
  cropBox: OutfitDetectionBoundingBox;
  sourceImageUrl: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      const sourceX = image.naturalWidth * cropBox.x;
      const sourceY = image.naturalHeight * cropBox.y;
      const sourceWidth = Math.max(1, image.naturalWidth * cropBox.width);
      const sourceHeight = Math.max(1, image.naturalHeight * cropBox.height);
      const outputWidth = 320;
      const outputHeight = Math.max(1, Math.round(outputWidth * (sourceHeight / sourceWidth)));

      canvas.width = outputWidth;
      canvas.height = outputHeight;

      context.clearRect(0, 0, outputWidth, outputHeight);
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        outputWidth,
        outputHeight,
      );
    };
    image.src = sourceImageUrl;
  }, [cropBox, sourceImageUrl]);

  return (
    <div className="overflow-hidden border border-border bg-muted">
      <canvas ref={canvasRef} className="block w-full h-auto" />
    </div>
  );
}

function DetectionDetail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border border-border/80 bg-background/40 px-3 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">{label}</p>
      <p>{value?.trim() ? value : "Not provided"}</p>
    </div>
  );
}
