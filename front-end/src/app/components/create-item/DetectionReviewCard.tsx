import { motion } from "motion/react";
import { Check, PencilLine, Sparkles } from "lucide-react";
import {
  ClothingItemFormValues,
  formatTagLabel,
  OutfitDetection,
  preferredDetectionBox,
  titleize,
} from "../../lib/closet";
import { AiCleanImageButton } from "../AiCleanImageButton";
import { ItemMetadataFields } from "../ItemMetadataFields";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { PrimitiveText } from "../primitives/PrimitiveText";
import { DetectionPreviewImage } from "./DetectionPreview";

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
          <PrimitiveText as="p" variant="overline" tone="muted" className="mb-2">
            {formatTagLabel(detection.category)}
          </PrimitiveText>
          <h3>{suggestedName}</h3>
        </div>
        <div className="h-10 w-10 border border-border rounded-full flex items-center justify-center bg-muted">
          <Sparkles className="w-4 h-4" />
        </div>
      </div>

      <PrimitiveText as="p" variant="bodySm" tone="muted">{confidenceLabel}</PrimitiveText>

      <div className="flex items-center justify-between gap-4">
        <PrimitiveText as="p" variant="overline" tone="muted">
          {cleanedImageUrl ? "AI-Cleaned Preview" : "Automated Crop Preview"}
        </PrimitiveText>
        <AiCleanImageButton
          disabled={!cleanedImageUrl && !previewBox}
          isLoading={isCleaningImage}
          onClick={onCleanImage}
        />
      </div>

      {cleanedImageUrl ? (
        <div className="overflow-hidden border border-border bg-muted">
          <DetectionPreviewImage
            alt={`${suggestedName} AI cleaned preview`}
            cleanedImageUrl={cleanedImageUrl}
          />
        </div>
      ) : sourceImageUrl && previewBox ? (
        <div className="space-y-3">
          <div className="overflow-hidden border border-border bg-muted">
            <DetectionPreviewImage
              alt={`${suggestedName} automated crop preview`}
              cropBox={previewBox}
              sourceImageUrl={sourceImageUrl}
            />
          </div>
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

      <div className="grid gap-3 sm:grid-cols-2">
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
        <PrimitiveButton
          type="button"
          onClick={onToggleEdit}
          variant="outline"
        >
          <PencilLine className="w-4 h-4" />
          {isEditing ? "Done editing" : "Edit"}
        </PrimitiveButton>
        <PrimitiveButton
          type="button"
          onClick={onToggle}
          disabled={!canSave}
          className={`disabled:opacity-50 ${
            isSelected
              ? "border-foreground bg-foreground text-background"
              : "border-border hover:border-foreground"
          }`}
          variant="outline"
        >
          <Check className="w-4 h-4" />
          {isSelected ? "Will save to closet" : canSave ? "Add to closet" : "Preview unavailable"}
        </PrimitiveButton>
      </div>
    </motion.div>
  );
}

function DetectionDetail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border border-border/80 bg-background/40 px-3 py-3">
      <PrimitiveText as="p" variant="overline" tone="muted" className="mb-2">
        {label}
      </PrimitiveText>
      <PrimitiveText as="p" variant="bodySm">
        {value?.trim() ? value : "Not provided"}
      </PrimitiveText>
    </div>
  );
}
