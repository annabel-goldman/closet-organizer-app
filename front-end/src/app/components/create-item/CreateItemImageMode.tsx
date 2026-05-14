import { RefObject, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, RotateCcw, Sparkles, Upload } from "lucide-react";
import {
  ClothingItemFormValues,
  formatTagLabel,
  OutfitDetection,
  OutfitUpload,
  preferredDetectionBox,
  titleize,
  User,
} from "../../lib/closet";
import { AiCleanImageButton } from "../AiCleanImageButton";
import { ItemMetadataFields } from "../ItemMetadataFields";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { PrimitiveText } from "../primitives/PrimitiveText";
import { UploadWorkspace } from "../UploadWorkspace";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { DetectionPreviewImage } from "./DetectionPreview";
import { DetectionThumbnailStrip } from "./DetectionThumbnailStrip";

interface CreateItemImageModeProps {
  cleaningDetectionIds: number[];
  detectionCleanErrors: Record<number, string>;
  detections: OutfitDetection[];
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
  onToggleSelection,
  outfitUpload,
  selectedCount,
  selectedDetectionIds,
  selectedFileName,
  sourceImageUrl,
  user,
}: CreateItemImageModeProps) {
  const detectionCount = detections.length;
  const [previewTarget, setPreviewTarget] = useState<"source" | number>("source");
  const [detailsDetectionId, setDetailsDetectionId] = useState<number | null>(null);
  const [isRedetectDialogOpen, setIsRedetectDialogOpen] = useState(false);
  const hasStartedDetectionFlow = Boolean(selectedFileName || isDetecting || outfitUpload);
  const hasDetectedItems = detectionCount > 0;

  useEffect(() => {
    if (detections.length === 0) {
      setPreviewTarget("source");
      setDetailsDetectionId(null);
      return;
    }

    setPreviewTarget((current) => {
      if (current === "source") {
        return current;
      }

      return detections.some((detection) => detection.id === current) ? current : detections[0].id;
    });
    setDetailsDetectionId((current) =>
      current && detections.some((detection) => detection.id === current) ? current : detections[0].id,
    );
  }, [detections]);

  const previewDetection =
    typeof previewTarget === "number"
      ? detections.find((detection) => detection.id === previewTarget) ?? null
      : null;
  const detailsDetection =
    detailsDetectionId == null
      ? null
      : detections.find((detection) => detection.id === detailsDetectionId) ?? null;
  const isSourceFocused = previewTarget === "source";
  const previewDetectionBox = previewDetection ? preferredDetectionBox(previewDetection) : null;
  const detailsPreviewBox = detailsDetection ? preferredDetectionBox(detailsDetection) : null;
  const focusedDraft = detailsDetection ? getDetectionDraft(detailsDetection) : null;
  const focusedSuggestedName = focusedDraft?.name.trim()
    || detailsDetection?.suggested_name?.trim()
    || (detailsDetection ? titleize(detailsDetection.category) : "");
  const focusedIsSelected = detailsDetection
    ? selectedDetectionIds.includes(detailsDetection.id)
    : false;
  const focusedCleanError = detailsDetection
    ? detectionCleanErrors[detailsDetection.id]
    : undefined;
  const focusedIsCleaning = detailsDetection
    ? cleaningDetectionIds.includes(detailsDetection.id)
    : false;
  const previewMedia = useMemo(() => {
    if (!previewDetection || !sourceImageUrl || !previewDetectionBox || previewDetection.cleaned_image_url) {
      return undefined;
    }

    return (
      <DetectionPreviewImage
        alt={`${focusedSuggestedName} preview`}
        cropBox={previewDetectionBox}
        sourceImageUrl={sourceImageUrl}
      />
    );
  }, [focusedSuggestedName, previewDetection, previewDetectionBox, sourceImageUrl]);
  const expandedPreview = useMemo(() => {
    if (!previewDetection || !sourceImageUrl || !previewDetectionBox || previewDetection.cleaned_image_url) {
      return undefined;
    }

    return (
      <DetectionPreviewImage
        alt={`${focusedSuggestedName} preview`}
        cropBox={previewDetectionBox}
        sourceImageUrl={sourceImageUrl}
      />
    );
  }, [focusedSuggestedName, previewDetection, previewDetectionBox, sourceImageUrl]);
  const sourcePreviewTitle = selectedFileName ?? "Upload an image";
  const sourcePreviewPrimaryDetail = isDetecting
    ? "Detecting items"
    : detectionCount > 0
      ? `${detectionCount} detected item${detectionCount === 1 ? "" : "s"}`
      : selectedFileName
        ? "Ready to detect"
        : "Awaiting image";
  const sourcePreviewSecondaryDetail = detectionCount > 0
    ? `${selectedCount} selected to save`
    : `Saving to ${titleize(user.username)}`;
  const shouldShowUploadPrompt = !selectedFileName && !isDetecting && !outfitUpload;
  const shouldShowInitialDetectPrompt = Boolean(selectedFileName) && !isDetecting && detectionCount === 0;
  const shouldShowRedetectPrompt = hasStartedDetectionFlow && detectionCount > 0 && isSourceFocused;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      <PrimitiveButton
        onClick={onBack}
        variant="outline"
        className="h-auto px-5 py-3"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </PrimitiveButton>

      <UploadWorkspace
        expandedPreview={expandedPreview}
        imageUrl={previewDetection?.cleaned_image_url ?? (isSourceFocused ? sourceImageUrl : null)}
        onPreviewClick={() => inputRef.current?.click()}
        onPreviewClear={selectedFileName ? onClearImageSelection : undefined}
        onPreviewEdit={selectedFileName ? () => inputRef.current?.click() : undefined}
        previewAriaLabel={selectedFileName ? "Change upload image" : "Upload photo"}
        previewBackgroundDecoration={
          isSourceFocused ? (
            <Upload
              className="h-40 w-40 text-stone-700/18 sm:h-52 sm:w-52"
              strokeWidth={1.1}
            />
          ) : undefined
        }
        previewMedia={previewDetection ? previewMedia : undefined}
        previewTopAction={
          previewDetection ? (
            <AiCleanImageButton
              className="size-11 border border-white/75 bg-white/70 p-0 shadow-sm backdrop-blur-sm hover:bg-white/85"
              disabled={!previewDetection.cleaned_image_url && !previewDetectionBox}
              iconOnly
              isLoading={focusedIsCleaning}
              label="AI clean PNG"
              onClick={() => onCleanDetectionImage(previewDetection.id)}
            />
          ) : undefined
        }
        previewLabel={previewDetection ? "Detected Item" : "Original Image"}
        previewPrimaryDetail={
          previewDetection
            ? formatTagLabel(previewDetection.category)
            : sourcePreviewPrimaryDetail
        }
        previewSecondaryDetail={
          previewDetection
            ? `${formatTagLabel(previewDetection.category)}${selectedDetectionIds.includes(previewDetection.id) ? " · selected for save" : ""}`
            : sourcePreviewSecondaryDetail
        }
        previewTitle={previewDetection ? titleize(previewDetection.suggested_name?.trim() || previewDetection.category) : sourcePreviewTitle}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          className="sr-only"
        />

        <DetectionThumbnailStrip
          detections={detections}
          focusedTarget={previewTarget}
          isDetecting={isDetecting}
          onSelectDetection={(detectionId) => {
            setPreviewTarget(detectionId);
            setDetailsDetectionId(detectionId);
          }}
          onSelectSource={() => setPreviewTarget("source")}
          sourceImageUrl={sourceImageUrl}
        />

        {errorMessage && (
          <div className="border border-destructive/20 bg-destructive/5 p-4 text-sm">
            {errorMessage}
          </div>
        )}

        {shouldShowUploadPrompt ? (
          <div className="border border-border bg-card p-5">
            <PrimitiveText as="p" variant="title" font="serif" className="mb-3">
              Upload an image to get started.
            </PrimitiveText>
            <PrimitiveText as="p" tone="muted">
              Our AI will analyze your image and pull out different items of clothing you&apos;re wearing, so you can add them to your closet.
            </PrimitiveText>
          </div>
        ) : null}

        {shouldShowInitialDetectPrompt ? (
          <div className="border border-border bg-card p-5 space-y-5">
            <PrimitiveText as="p" tone="muted">
              Press the button below to detect your items.
            </PrimitiveText>
            <PrimitiveButton
              type="button"
              onClick={onDetectItems}
              disabled={isDetecting || !selectedFileName}
              className="h-auto self-start bg-foreground px-5 py-3 text-background hover:bg-foreground/90"
            >
              <Sparkles className="w-4 h-4" />
              Detect Items
            </PrimitiveButton>
          </div>
        ) : null}

        {shouldShowRedetectPrompt ? (
          <div className="border border-border bg-card p-5 space-y-5">
            <PrimitiveText as="p" tone="muted">
              Press this button to re-detect your items. Warning: this will override your existing items.
            </PrimitiveText>
            <AlertDialog open={isRedetectDialogOpen} onOpenChange={setIsRedetectDialogOpen}>
              <AlertDialogTrigger asChild>
                <PrimitiveButton
                  type="button"
                  disabled={isDetecting || !selectedFileName}
                  className="h-auto self-start bg-foreground px-5 py-3 text-background hover:bg-foreground/90"
                >
                  <Sparkles className="w-4 h-4" />
                  <RotateCcw className="w-4 h-4" />
                  Re-detect Items
                </PrimitiveButton>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Proceed?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will discard all currently detected items. Proceed?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDetectItems}>Proceed</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}

        {!hasStartedDetectionFlow || isDetecting || !outfitUpload || detectionCount === 0 || !detailsDetection || !focusedDraft || isSourceFocused ? null : (
          <div className="border border-border bg-card p-5 space-y-5">
            <div>
              <PrimitiveText as="p" variant="overline" tone="muted" className="mb-2">
                {formatTagLabel(detailsDetection.category)}
              </PrimitiveText>
              <PrimitiveText as="h2" variant="title" font="serif" className="mb-1">
                {focusedSuggestedName}
              </PrimitiveText>
            </div>

            {focusedCleanError && (
              <div className="border border-destructive/20 bg-destructive/5 px-3 py-3 text-sm">
                {focusedCleanError}
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <ItemMetadataFields
                values={focusedDraft}
                onChange={(nextValues) => onDraftChange(detailsDetection.id, nextValues)}
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <PrimitiveButton
                type="button"
                onClick={() => onToggleSelection(detailsDetection)}
                disabled={!detailsPreviewBox}
                variant="outline"
                className={`disabled:opacity-50 ${
                  focusedIsSelected
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-foreground"
                }`}
              >
                <Check className="w-4 h-4" />
                {focusedIsSelected ? "Will save to closet" : "Add to closet"}
              </PrimitiveButton>
            </div>
          </div>
        )}

        {hasStartedDetectionFlow && detectionCount > 0 && !isSourceFocused ? (
          <div className="mt-auto pt-2 flex items-center justify-between gap-4">
            <div />
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
        ) : null}
      </UploadWorkspace>
    </div>
  );
}
