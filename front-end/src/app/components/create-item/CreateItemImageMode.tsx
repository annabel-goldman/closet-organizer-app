import { RefObject } from "react";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import {
  ClothingItemFormValues,
  formatPossessive,
  OutfitDetection,
  OutfitUpload,
  titleize,
  User,
} from "../../lib/closet";
import { DetectionReviewCard } from "./DetectionReviewCard";
import { ItemPhotoField } from "../ItemPhotoField";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { PrimitiveText } from "../primitives/PrimitiveText";
import { UploadWorkspace } from "../UploadWorkspace";

interface CreateItemImageModeProps {
  cleaningDetectionIds: number[];
  detectionCleanErrors: Record<number, string>;
  detections: OutfitDetection[];
  editingDetectionIds: number[];
  errorMessage: string;
  getDetectionDraft: (detection: OutfitDetection) => ClothingItemFormValues;
  isCreating: boolean;
  isDetecting: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onBack: () => void;
  onClearImageSelection: () => void;
  onCleanDetectionImage: (detectionId: number) => void;
  onDetectItems: () => void;
  onDraftChange: (detectionId: number, nextValues: ClothingItemFormValues) => void;
  onFileChange: (file: File | null) => void;
  onSaveSelectedItems: () => void;
  onToggleEdit: (detection: OutfitDetection) => void;
  onToggleSelection: (detection: OutfitDetection) => void;
  outfitUpload: OutfitUpload | null;
  selectedCount: number;
  selectedDetectionIds: number[];
  selectedFileName?: string;
  sourceImageUrl: string | null;
  user: User;
}

export function CreateItemImageMode({
  cleaningDetectionIds,
  detectionCleanErrors,
  detections,
  editingDetectionIds,
  errorMessage,
  getDetectionDraft,
  isCreating,
  isDetecting,
  inputRef,
  onBack,
  onClearImageSelection,
  onCleanDetectionImage,
  onDetectItems,
  onDraftChange,
  onFileChange,
  onSaveSelectedItems,
  onToggleEdit,
  onToggleSelection,
  outfitUpload,
  selectedCount,
  selectedDetectionIds,
  selectedFileName,
  sourceImageUrl,
  user,
}: CreateItemImageModeProps) {
  const detectionCount = detections.length;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">
      <PrimitiveButton
        onClick={onBack}
        variant="ghost"
        className="h-auto px-0 py-0 text-muted-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </PrimitiveButton>

      <UploadWorkspace
        imageUrl={sourceImageUrl}
        previewLabel="Uploaded Image"
        previewPrimaryDetail={
          isDetecting
            ? "Detecting items"
            : detectionCount > 0
              ? `${detectionCount} detected item${detectionCount === 1 ? "" : "s"}`
              : selectedFileName
                ? "Ready to detect"
                : "Awaiting image"
        }
        previewSecondaryDetail={`Saving to ${formatPossessive(titleize(user.username))}`}
        previewTitle={selectedFileName ?? "Upload an image"}
      >
        <div>
          <PrimitiveText as="p" variant="overline" tone="muted" className="mb-3">
            Image Upload
          </PrimitiveText>
          <PrimitiveText as="h1" variant="display" font="serif" className="mb-1">
            Review Detected Items
          </PrimitiveText>
          <PrimitiveText as="p" tone="muted">
            Upload an image first, then run detection when you are ready. Verified pieces can be saved
            directly to {formatPossessive(titleize(user.username))}.
          </PrimitiveText>
        </div>

        {errorMessage && (
          <div className="border border-destructive/20 bg-destructive/5 p-4 text-sm">
            {errorMessage}
          </div>
        )}

        <div className="border border-border bg-card p-5">
          <PrimitiveText as="p" variant="overline" tone="muted" className="mb-3">
            Upload Photo
          </PrimitiveText>
          <ItemPhotoField
            description="Choose the source image now. Detection only runs after you click the button below."
            inputRef={inputRef}
            onClearSelection={onClearImageSelection}
            onFileChange={onFileChange}
            selectedFileName={selectedFileName}
          />
        </div>

        <div className="border border-border bg-card p-5">
          <PrimitiveText as="p" variant="overline" tone="muted" className="mb-3">
            Detection
          </PrimitiveText>
          <PrimitiveText as="p" variant="bodySm" tone="muted" className="mb-4">
            We refine and verify each detected crop before it becomes selectable below.
          </PrimitiveText>
          <div className="flex items-center justify-between gap-4">
            <PrimitiveButton
              type="button"
              onClick={onClearImageSelection}
              variant="ghost"
              size="sm"
              className="h-auto px-0 py-0 text-muted-foreground"
            >
              Reset
            </PrimitiveButton>
            <PrimitiveButton
              type="button"
              onClick={onDetectItems}
              disabled={isDetecting || !selectedFileName}
              className="h-auto bg-foreground px-5 py-3 text-background hover:bg-foreground/90"
            >
              <Sparkles className="w-4 h-4" />
              {isDetecting ? "Detecting items..." : "Detect items"}
            </PrimitiveButton>
          </div>
        </div>
      </UploadWorkspace>

      <div className="space-y-4 border-t border-border pt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <PrimitiveText as="p" variant="overline" tone="muted" className="mb-3">
              Detected Items
            </PrimitiveText>
            <PrimitiveText as="h2" variant="title" font="serif" className="mb-1">
              Choose what to save
            </PrimitiveText>
            <PrimitiveText as="p" tone="muted">
              Review what the model found and choose any item you want to save to the closet.
            </PrimitiveText>
          </div>
          <PrimitiveText as="div" variant="bodySm" tone="muted">
            {selectedCount} selected
          </PrimitiveText>
        </div>

        {!selectedFileName ? (
          <div className="border border-dashed border-border p-8 text-center">
            <PrimitiveText as="p" variant="display" font="serif" className="mb-2">
              Upload an image to begin
            </PrimitiveText>
            <PrimitiveText as="p" tone="muted">
              Choosing an image from the closet page will bring you here automatically.
            </PrimitiveText>
          </div>
        ) : isDetecting ? (
          <div className="border border-border bg-card p-8 text-center">
            <PrimitiveText as="p" variant="display" font="serif" className="mb-2">
              Detecting, refining, and verifying crops
            </PrimitiveText>
            <PrimitiveText as="p" tone="muted">
              We are running the automated crop pipeline and preparing item-specific previews.
            </PrimitiveText>
          </div>
        ) : !outfitUpload ? (
          <div className="border border-dashed border-border p-8 text-center">
            <PrimitiveText as="p" variant="display" font="serif" className="mb-2">
              Detect items when you are ready
            </PrimitiveText>
            <PrimitiveText as="p" tone="muted">
              The selected image is ready. Click the button on the right to populate detected items
              below.
            </PrimitiveText>
          </div>
        ) : outfitUpload.status === "failed" && outfitUpload.error_message ? (
          <div className="border border-destructive/20 bg-destructive/5 p-6 text-sm">
            {outfitUpload.error_message}
          </div>
        ) : detectionCount === 0 ? (
          <div className="border border-dashed border-border p-8 text-center">
            <PrimitiveText as="p" variant="display" font="serif" className="mb-2">
              No items detected yet
            </PrimitiveText>
            <PrimitiveText as="p" tone="muted">
              Try another image if the visible pieces are not being picked up clearly.
            </PrimitiveText>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {detections.map((detection, index) => (
              <DetectionReviewCard
                key={detection.id}
                cleanImageError={detectionCleanErrors[detection.id]}
                cleanedImageUrl={detection.cleaned_image_url ?? null}
                detection={detection}
                draftValues={getDetectionDraft(detection)}
                index={index}
                isCleaningImage={cleaningDetectionIds.includes(detection.id)}
                isEditing={editingDetectionIds.includes(detection.id)}
                isSelected={selectedDetectionIds.includes(detection.id)}
                onCleanImage={() => onCleanDetectionImage(detection.id)}
                onDraftChange={(nextValues) => onDraftChange(detection.id, nextValues)}
                onToggle={() => onToggleSelection(detection)}
                onToggleEdit={() => onToggleEdit(detection)}
                sourceImageUrl={sourceImageUrl}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border pt-6 flex items-center justify-between gap-4">
        <PrimitiveText as="p" variant="bodySm" tone="muted">
          Selected items will use the best available crop from the uploaded image.
        </PrimitiveText>
        <PrimitiveButton
          type="button"
          onClick={onSaveSelectedItems}
          disabled={isCreating || selectedCount === 0}
          className="h-auto bg-foreground px-5 py-3 text-background hover:bg-foreground/90"
        >
          <Check className="w-4 h-4" />
          {isCreating ? "Saving..." : "Save to closet"}
        </PrimitiveButton>
      </div>
    </div>
  );
}
