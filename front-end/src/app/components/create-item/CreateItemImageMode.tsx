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
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

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
          <p className="uppercase tracking-[0.3em] text-xs text-muted-foreground mb-3">
            Image Upload
          </p>
          <h1 className="mb-1">Review Detected Items</h1>
          <p className="text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            Upload an image first, then run detection when you are ready. Verified pieces can be saved
            directly to {formatPossessive(titleize(user.username))}.
          </p>
        </div>

        {errorMessage && (
          <div className="border border-destructive/20 bg-destructive/5 p-4 text-sm">
            {errorMessage}
          </div>
        )}

        <div className="border border-border bg-card p-5">
          <p className="uppercase tracking-[0.2em] text-xs text-muted-foreground mb-3">
            Upload Photo
          </p>
          <ItemPhotoField
            description="Choose the source image now. Detection only runs after you click the button below."
            inputRef={inputRef}
            onClearSelection={onClearImageSelection}
            onFileChange={onFileChange}
            selectedFileName={selectedFileName}
          />
        </div>

        <div className="border border-border bg-card p-5">
          <p className="uppercase tracking-[0.2em] text-xs text-muted-foreground mb-3">
            Detection
          </p>
          <p className="text-sm text-muted-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
            We refine and verify each detected crop before it becomes selectable below.
          </p>
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onClearImageSelection}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onDetectItems}
              disabled={isDetecting || !selectedFileName}
              className="inline-flex items-center gap-2 px-5 py-3 bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {isDetecting ? "Detecting items..." : "Detect items"}
            </button>
          </div>
        </div>
      </UploadWorkspace>

      <div className="space-y-4 border-t border-border pt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="uppercase tracking-[0.3em] text-xs text-muted-foreground mb-3">
              Detected Items
            </p>
            <h2 className="mb-1">Choose what to save</h2>
            <p className="text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              Review what the model found and choose any item you want to save to the closet.
            </p>
          </div>
          <div className="text-sm text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            {selectedCount} selected
          </div>
        </div>

        {!selectedFileName ? (
          <div className="border border-dashed border-border p-8 text-center">
            <p className="text-2xl mb-2" style={{ fontFamily: "Cormorant Garamond, serif" }}>
              Upload an image to begin
            </p>
            <p className="text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              Choosing an image from the closet page will bring you here automatically.
            </p>
          </div>
        ) : isDetecting ? (
          <div className="border border-border bg-card p-8 text-center">
            <p className="text-2xl mb-2" style={{ fontFamily: "Cormorant Garamond, serif" }}>
              Detecting, refining, and verifying crops
            </p>
            <p className="text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              We are running the automated crop pipeline and preparing item-specific previews.
            </p>
          </div>
        ) : !outfitUpload ? (
          <div className="border border-dashed border-border p-8 text-center">
            <p className="text-2xl mb-2" style={{ fontFamily: "Cormorant Garamond, serif" }}>
              Detect items when you are ready
            </p>
            <p className="text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              The selected image is ready. Click the button on the right to populate detected items
              below.
            </p>
          </div>
        ) : outfitUpload.status === "failed" && outfitUpload.error_message ? (
          <div className="border border-destructive/20 bg-destructive/5 p-6 text-sm">
            {outfitUpload.error_message}
          </div>
        ) : detectionCount === 0 ? (
          <div className="border border-dashed border-border p-8 text-center">
            <p className="text-2xl mb-2" style={{ fontFamily: "Cormorant Garamond, serif" }}>
              No items detected yet
            </p>
            <p className="text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              Try another image if the visible pieces are not being picked up clearly.
            </p>
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
        <p className="text-sm text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
          Selected items will use the best available crop from the uploaded image.
        </p>
        <button
          type="button"
          onClick={onSaveSelectedItems}
          disabled={isCreating || selectedCount === 0}
          className="inline-flex items-center gap-2 px-5 py-3 bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          {isCreating ? "Saving..." : "Save to closet"}
        </button>
      </div>
    </div>
  );
}
