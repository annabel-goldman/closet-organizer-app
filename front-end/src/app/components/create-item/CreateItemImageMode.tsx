import { RefObject, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, LoaderCircle, RotateCcw, RotateCw, Sparkles, Upload } from "lucide-react";
import {
  buildItemPreviewMetadata,
  ClothingItemFormValues,
  formatTagLabel,
  OutfitDetection,
  OutfitUpload,
  preferredDetectionBox,
  parseTagInput,
  titleize,
  User,
} from "../../lib/closet";
import { AiMetadataAutofillButton } from "../AiMetadataAutofillButton";
import { ItemMetadataFields } from "../ItemMetadataFields";
import { ItemMetadataPanel } from "../ItemMetadataPanel";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { PrimitiveConfirmationDialog } from "../primitives/PrimitiveConfirmationDialog";
import { AiActionLoadingNotice } from "../shared/AiActionLoadingNotice";
import { UploadWorkspace } from "../UploadWorkspace";
import type { ExpandedImageEditorApplyContext } from "../ExpandedImageEditor";
import { DetectionPreviewImage } from "./DetectionPreview";
import { DetectionThumbnailStrip } from "./DetectionThumbnailStrip";

interface CreateItemImageModeProps {
  autofillingDetectionId: number | null;
  brandSuggestions?: string[];
  canRedoDetectionDraft: (detectionId: number) => boolean;
  canUndoDetectionDraft: (detectionId: number) => boolean;
  cleaningDetectionIds: number[];
  detectionImageKind: (detection: OutfitDetection) => "cleaned" | "transparent" | null;
  detectionCleanErrors: Record<number, string>;
  detections: OutfitDetection[];
  errorMessage: string;
  getDetectionCleanedImageUrl: (detection: OutfitDetection) => string | null;
  getDetectionDraft: (detection: OutfitDetection) => ClothingItemFormValues;
  hasDetectionDraft: (detectionId: number) => boolean;
  isPreparingDetectedMetadata: boolean;
  isCreating: boolean;
  isDetecting: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  makingDetectionTransparentIds: number[];
  onBack: () => void;
  onApplySourceImageEdits?: (
    file: File,
    context: ExpandedImageEditorApplyContext,
  ) => Promise<void> | void;
  onApplyDetectionImageEdits?: (
    detection: OutfitDetection,
    file: File,
    context: ExpandedImageEditorApplyContext,
  ) => Promise<void> | void;
  onClearImageSelection: () => void;
  onCreateDetectionEditorCleanImage?: (detection: OutfitDetection, file: File) => Promise<File>;
  onCreateDetectionEditorTransparentPng?: (file: File) => Promise<File>;
  onDetectItems: () => void;
  onDraftChange: (detection: OutfitDetection, nextValues: ClothingItemFormValues) => void;
  onFileChange: (file: File | null) => void;
  onGetDetectionImageEditorFile?: (detection: OutfitDetection) => Promise<File | null>;
  onGetSourceImageEditorFile?: () => Promise<File | null>;
  onRequestDetectionAutofill: (detection: OutfitDetection) => void;
  onRedoDetectionDraft: (detection: OutfitDetection) => void;
  onSaveSelectedItems: () => void;
  onToggleSelection: (detection: OutfitDetection) => void;
  onUndoDetectionDraft: (detection: OutfitDetection) => void;
  outfitUpload: OutfitUpload | null;
  selectedCount: number;
  selectedDetectionIds: number[];
  selectedFileName?: string;
  sourceImageUrl: string | null;
  tagSuggestions?: string[];
  user: User;
}

export function CreateItemImageMode({
  autofillingDetectionId,
  brandSuggestions = [],
  canRedoDetectionDraft,
  canUndoDetectionDraft,
  cleaningDetectionIds,
  detectionImageKind,
  detectionCleanErrors,
  detections,
  errorMessage,
  getDetectionCleanedImageUrl,
  getDetectionDraft,
  hasDetectionDraft,
  isPreparingDetectedMetadata,
  isCreating,
  isDetecting,
  inputRef,
  makingDetectionTransparentIds,
  onBack,
  onApplyDetectionImageEdits,
  onApplySourceImageEdits,
  onClearImageSelection,
  onCreateDetectionEditorCleanImage,
  onCreateDetectionEditorTransparentPng,
  onDetectItems,
  onDraftChange,
  onFileChange,
  onGetDetectionImageEditorFile,
  onGetSourceImageEditorFile,
  onRequestDetectionAutofill,
  onRedoDetectionDraft,
  onSaveSelectedItems,
  onToggleSelection,
  onUndoDetectionDraft,
  outfitUpload,
  selectedCount,
  selectedDetectionIds,
  selectedFileName,
  sourceImageUrl,
  tagSuggestions = [],
  user,
}: CreateItemImageModeProps) {
  const detectionCount = detections.length;
  const [previewTarget, setPreviewTarget] = useState<"source" | number>("source");
  const [detailsDetectionId, setDetailsDetectionId] = useState<number | null>(null);
  const [isRedetectDialogOpen, setIsRedetectDialogOpen] = useState(false);
  const [isSaveWarningDialogOpen, setIsSaveWarningDialogOpen] = useState(false);
  const previousDetectionCountRef = useRef(0);
  const hasStartedDetectionFlow = Boolean(selectedFileName || isDetecting || outfitUpload);

  useEffect(() => {
    const previousDetectionCount = previousDetectionCountRef.current;
    previousDetectionCountRef.current = detections.length;

    if (detections.length === 0) {
      setPreviewTarget("source");
      setDetailsDetectionId(null);
      return;
    }

    if (previousDetectionCount === 0) {
      setPreviewTarget(detections[0].id);
      setDetailsDetectionId(detections[0].id);
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
      ? previewDetection
      : detections.find((detection) => detection.id === detailsDetectionId) ?? previewDetection ?? null;
  const isSourceFocused = previewTarget === "source";
  const previewDetectionBox = previewDetection ? preferredDetectionBox(previewDetection) : null;
  const detailsPreviewBox = detailsDetection ? preferredDetectionBox(detailsDetection) : null;
  const detailsDraftReady = detailsDetection ? hasDetectionDraft(detailsDetection.id) : false;
  const focusedDraft = detailsDetection ? getDetectionDraft(detailsDetection) : null;
  const focusedSuggestedName = focusedDraft?.name.trim()
    || detailsDetection?.suggested_name?.trim()
    || (detailsDetection ? titleize(detailsDetection.category) : "");
  const focusedPreviewMetadata = focusedDraft
    ? buildItemPreviewMetadata(focusedDraft.size, parseTagInput(focusedDraft.tags))
    : "";
  const focusedIsSelected = detailsDetection
    ? selectedDetectionIds.includes(detailsDetection.id)
    : false;
  const focusedCleanError = detailsDetection
    ? detectionCleanErrors[detailsDetection.id]
    : undefined;
  const previewDetectionCleanedImageUrl = previewDetection
    ? getDetectionCleanedImageUrl(previewDetection)
    : null;
  const detailsDetectionCleanedImageUrl = detailsDetection
    ? getDetectionCleanedImageUrl(detailsDetection)
    : null;
  const focusedIsCleaning = detailsDetection
    ? cleaningDetectionIds.includes(detailsDetection.id)
    : false;
  const focusedIsMakingTransparent = detailsDetection
    ? makingDetectionTransparentIds.includes(detailsDetection.id)
    : false;
  const previewDetectionImageKind = previewDetection
    ? detectionImageKind(previewDetection)
    : null;
  const focusedIsAutofilling = detailsDetection
    ? autofillingDetectionId === detailsDetection.id
    : false;
  const detectionHistoryDisabled = isCreating || focusedIsAutofilling || isPreparingDetectedMetadata;
  const previewMedia = useMemo(() => {
    if (!previewDetection || !sourceImageUrl || !previewDetectionBox || previewDetectionCleanedImageUrl) {
      return undefined;
    }

    return (
      <DetectionPreviewImage
        alt={`${focusedSuggestedName} preview`}
        cropBox={previewDetectionBox}
        sourceImageUrl={sourceImageUrl}
      />
    );
  }, [focusedSuggestedName, previewDetection, previewDetectionBox, previewDetectionCleanedImageUrl, sourceImageUrl]);
  const expandedPreview = useMemo(() => {
    if (!previewDetection || !sourceImageUrl || !previewDetectionBox || previewDetectionCleanedImageUrl) {
      return undefined;
    }

    return (
      <DetectionPreviewImage
        alt={`${focusedSuggestedName} preview`}
        cropBox={previewDetectionBox}
        sourceImageUrl={sourceImageUrl}
      />
    );
  }, [focusedSuggestedName, previewDetection, previewDetectionBox, previewDetectionCleanedImageUrl, sourceImageUrl]);
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
  const shouldShowInitialDetectPrompt = Boolean(selectedFileName) && detectionCount === 0;
  const shouldShowRedetectPrompt = hasStartedDetectionFlow && detectionCount > 0 && isSourceFocused;
  const isLoadingDetectedMetadata = isPreparingDetectedMetadata || autofillingDetectionId !== null;
  const shouldShowMetadataLoadingState =
    detectionCount > 0
    && !isSourceFocused
    && (!detailsDetection || !detailsDraftReady || isLoadingDetectedMetadata);
  const hasUnsavedDetectedItems = selectedCount < detectionCount;
  const detectPromptCopy = "Press the button below to detect your items.";

  return (
    <div className="max-w-7xl mx-auto px-6 pt-12 pb-24 space-y-8">
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
        imageUrl={previewDetectionCleanedImageUrl ?? (isSourceFocused ? sourceImageUrl : null)}
        isPreviewProcessing={focusedIsCleaning || focusedIsMakingTransparent}
        onPreviewClick={() => inputRef.current?.click()}
        onPreviewClear={selectedFileName ? onClearImageSelection : undefined}
        onPreviewEdit={selectedFileName ? () => inputRef.current?.click() : undefined}
        previewEditor={
          isSourceFocused && selectedFileName && onGetSourceImageEditorFile && onApplySourceImageEdits
            ? {
                getEditableFile: onGetSourceImageEditorFile,
                onApply: onApplySourceImageEdits,
              }
            : previewDetection
              && onGetDetectionImageEditorFile
              && onApplyDetectionImageEdits
              ? {
                  getEditableFile: () => onGetDetectionImageEditorFile(previewDetection),
                  imageActions: {
                    initialKind: previewDetectionImageKind ?? "base",
                    onClean: onCreateDetectionEditorCleanImage
                      ? (file) => onCreateDetectionEditorCleanImage(previewDetection, file)
                      : undefined,
                    onMakeTransparent: onCreateDetectionEditorTransparentPng,
                  },
                  onApply: (file, context) => onApplyDetectionImageEdits(previewDetection, file, context),
                }
            : undefined
        }
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
        previewLabel={previewDetection ? "Detected Item" : "Original Image"}
        previewPrimaryDetail={
          previewDetection
            ? focusedPreviewMetadata
            : sourcePreviewPrimaryDetail
        }
        previewSecondaryDetail={
          previewDetection
            ? null
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
          getDetectionPreviewImageUrl={getDetectionCleanedImageUrl}
          isDetecting={isDetecting}
          onSelectDetection={(detectionId) => {
            setPreviewTarget(detectionId);
            setDetailsDetectionId(detectionId);
          }}
          onSelectSource={() => setPreviewTarget("source")}
          selectedDetectionIds={selectedDetectionIds}
          sourceImageUrl={sourceImageUrl}
        />

        {errorMessage && (
          <div className="border border-destructive/20 bg-destructive/5 p-4 text-sm">
            {errorMessage}
          </div>
        )}

        {shouldShowUploadPrompt ? (
          <div className="border border-border bg-card p-5">
            <p>Upload an image to get started.</p>
            <p>
              Our AI will analyze your image and pull out different items of clothing you&apos;re
              wearing, so you can add them to your closet.
            </p>
          </div>
        ) : null}

        {shouldShowInitialDetectPrompt ? (
          <div className="border border-border bg-card p-5 space-y-5">
            <p>{detectPromptCopy}</p>
            <PrimitiveButton
              type="button"
              onClick={onDetectItems}
              disabled={isDetecting || !selectedFileName}
              className={`h-auto self-start bg-foreground px-5 py-3 text-background hover:bg-foreground/90 ${
                isDetecting ? "min-w-40 justify-center" : ""
              }`}
              aria-busy={isDetecting}
            >
              {isDetecting ? (
                <>
                  <LoaderCircle className="w-4 h-4 animate-spin" />
                  <span>Detect Items</span>
                  <span className="inline-flex items-center gap-1" aria-hidden="true">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                  </span>
                  <span className="sr-only">Detecting items</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Detect Items
                </>
              )}
            </PrimitiveButton>
          </div>
        ) : null}

        {shouldShowRedetectPrompt ? (
          <div className="border border-border bg-card p-5 space-y-5">
            <p>
              Press this button to re-detect your items. Warning: this will override your existing
              items.
            </p>
            <PrimitiveConfirmationDialog
              description="This will discard all currently detected items. Proceed?"
              onConfirm={onDetectItems}
              onOpenChange={setIsRedetectDialogOpen}
              open={isRedetectDialogOpen}
            >
              <PrimitiveButton
                type="button"
                disabled={isDetecting || !selectedFileName}
                className="h-auto self-start bg-foreground px-5 py-3 text-background hover:bg-foreground/90"
              >
                <Sparkles className="w-4 h-4" />
                <RotateCcw className="w-4 h-4" />
                Re-detect Items
              </PrimitiveButton>
            </PrimitiveConfirmationDialog>
          </div>
        ) : null}

        {shouldShowMetadataLoadingState && (!detailsDetection || !detailsDraftReady) ? (
          <div className="border border-border bg-card p-5">
            <AiActionLoadingNotice message="Preparing detected item details. Type, name, brand, and tags may update in a moment." />
          </div>
        ) : null}

        {!hasStartedDetectionFlow || isDetecting || !outfitUpload || detectionCount === 0 || !detailsDetection || !focusedDraft || !detailsDraftReady || isSourceFocused ? null : (
          <ItemMetadataPanel
            action={
              <div className="mt-0.5 flex items-center gap-2 self-start">
                <PrimitiveButton
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!canUndoDetectionDraft(detailsDetection.id) || detectionHistoryDisabled}
                  onClick={() => onUndoDetectionDraft(detailsDetection)}
                  aria-label="Undo detected item detail change"
                >
                  <RotateCcw className="h-4 w-4" />
                </PrimitiveButton>
                <PrimitiveButton
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!canRedoDetectionDraft(detailsDetection.id) || detectionHistoryDisabled}
                  onClick={() => onRedoDetectionDraft(detailsDetection)}
                  aria-label="Redo detected item detail change"
                >
                  <RotateCw className="h-4 w-4" />
                </PrimitiveButton>
                <AiMetadataAutofillButton
                  className="mt-0 h-9 w-9 shrink-0"
                  disabled={!detailsPreviewBox && !detailsDetectionCleanedImageUrl}
                  isLoading={focusedIsAutofilling}
                  label="AI autofill type, name, brand, and tags"
                  onClick={() => onRequestDetectionAutofill(detailsDetection)}
                />
              </div>
            }
            category={focusedDraft.category || detailsDetection.category}
            title={focusedSuggestedName}
          >
            {isPreparingDetectedMetadata ? (
              <AiActionLoadingNotice message="Preparing detected item details. Type, name, brand, and tags may update in a moment." />
            ) : null}

            {focusedCleanError && (
              <div className="border border-destructive/20 bg-destructive/5 px-3 py-3 text-sm">
                {focusedCleanError}
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-3">
              <ItemMetadataFields
                autofillDisabled={!detailsPreviewBox && !detailsDetectionCleanedImageUrl}
                brandSuggestions={brandSuggestions}
                fieldIdPrefix={`detection-${detailsDetection.id}-`}
                isAutofilling={focusedIsAutofilling}
                showAutofillButton={false}
                tagSuggestions={tagSuggestions}
                values={focusedDraft}
                onChange={(nextValues) => onDraftChange(detailsDetection, nextValues)}
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
          </ItemMetadataPanel>
        )}

        {hasStartedDetectionFlow && detectionCount > 0 && !isSourceFocused ? (
          <div className="mt-auto pt-2 flex items-center justify-between gap-4">
            <div />
            {hasUnsavedDetectedItems ? (
              <PrimitiveConfirmationDialog
                confirmLabel={isCreating ? "Saving..." : "Save to closet"}
                description="Warning, you've not saved all detected items. This will override those items if you don't save them."
                onConfirm={onSaveSelectedItems}
                onOpenChange={setIsSaveWarningDialogOpen}
                open={isSaveWarningDialogOpen}
              >
                <PrimitiveButton
                  type="button"
                  disabled={isCreating || selectedCount === 0}
                  className="h-auto bg-foreground px-5 py-3 text-background hover:bg-foreground/90"
                >
                  <Check className="w-4 h-4" />
                  {isCreating ? "Saving..." : "Save to closet"}
                </PrimitiveButton>
              </PrimitiveConfirmationDialog>
            ) : (
              <PrimitiveButton
                type="button"
                onClick={onSaveSelectedItems}
                disabled={isCreating || selectedCount === 0}
                className="h-auto bg-foreground px-5 py-3 text-background hover:bg-foreground/90"
              >
                <Check className="w-4 h-4" />
                {isCreating ? "Saving..." : "Save to closet"}
              </PrimitiveButton>
            )}
          </div>
        ) : null}
      </UploadWorkspace>
    </div>
  );
}
