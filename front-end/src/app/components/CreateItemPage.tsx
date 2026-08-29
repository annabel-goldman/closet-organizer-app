import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, RotateCcw, RotateCw, Upload } from "lucide-react";
import {
  buildItemPreviewMetadata,
  AiWorkflow,
  ClothingItem,
  ClothingItemFormValues,
  createClothingItem,
  createCleanPreviewFile,
  createOutfitUpload,
  CreateItemMode,
  emptyClothingItemFormValues,
  fetchImageFileFromUrl,
  fetchOutfitUpload,
  fetchUser,
  generateOutfitDetectionMetadataSuggestions,
  mergeMetadataSuggestion,
  OutfitDetection,
  OutfitUpload,
  parseTagInput,
  preferredDetectionBox,
  previewMetadataSuggestions,
  saveClothingItem,
  toClothingItemFormValuesFromDetection,
  User,
} from "../lib/closet";
import {
  ClothingItemFormErrors,
  clothingItemFieldElementId,
  collectClosetSuggestions,
  firstInvalidClothingItemField,
  hasClothingItemFormErrors,
  validateClothingItemForm,
} from "../lib/itemFormValidation";
import { usePageData } from "../lib/usePageData";
import { AiCleanImageButton } from "./AiCleanImageButton";
import { AiMetadataAutofillButton } from "./AiMetadataAutofillButton";
import { CreateItemImageMode } from "./create-item/CreateItemImageMode";
import { ItemEditorWorkspace } from "./ItemEditorWorkspace";
import { ItemMetadataFields } from "./ItemMetadataFields";
import { ItemMetadataPanel } from "./ItemMetadataPanel";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveConfirmationDialog } from "./primitives/PrimitiveConfirmationDialog";
import { PrimitiveText } from "./primitives/PrimitiveText";
import { useItemPhotoState } from "../lib/useItemPhotoState";
import type { ItemPhotoStateSnapshot } from "../lib/useItemPhotoState";
import { useUndoRedoShortcuts } from "../lib/useUndoRedoShortcuts";
import { mapWithConcurrency } from "../lib/asyncPool";
import type { ExpandedImageEditorApplyContext } from "./ExpandedImageEditor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

interface CreateItemPageProps {
  userId: number | null;
  initialMode?: CreateItemMode;
  initialUser?: User | null;
  initialOutfitUploadIds?: number[];
  onBack: () => void;
  onItemsCreated: (items: ClothingItem[]) => void;
  onGenerationTaskStarted: (workflow: AiWorkflow, label: string) => void;
}

interface ManualCreateUndoSnapshot {
  formValues: ClothingItemFormValues;
  originalUploadedPhoto: File | null;
  photoState: ItemPhotoStateSnapshot;
  selectedImageKind: ExpandedImageEditorApplyContext["imageKind"];
}

type DetectionDraftHistory = Record<number, ClothingItemFormValues[]>;

export function CreateItemPage({
  userId,
  initialMode = "manual",
  initialUser,
  initialOutfitUploadIds = [],
  onBack,
  onItemsCreated,
  onGenerationTaskStarted,
}: CreateItemPageProps) {
  const detectionPollControllersRef = useRef<Map<number, AbortController>>(new Map());
  const resumedOutfitUploadIdsRef = useRef<Set<number>>(new Set());
  const isMountedRef = useRef(true);
  const detectionMetadataRunRef = useRef(0);
  const preparingMetadataRunsRef = useRef(0);
  const originalUploadedPhotoRef = useRef<File | null>(null);
  const pendingManualCleanPromiseRef = useRef<Promise<File> | null>(null);
  const pendingManualCleanModeRef = useRef<"preview" | "attach" | "ignore">("preview");
  const [formValues, setFormValues] = useState(emptyClothingItemFormValues);
  const [fieldErrors, setFieldErrors] = useState<ClothingItemFormErrors>({});
  const [isCreating, setIsCreating] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isCleaningUploadedPhoto, setIsCleaningUploadedPhoto] = useState(false);
  const [isAutofillingMetadata, setIsAutofillingMetadata] = useState(false);
  const [autofillingDetectionId, setAutofillingDetectionId] = useState<number | null>(null);
  const [isPreparingDetectedMetadata, setIsPreparingDetectedMetadata] = useState(false);
  const [isManualCreateWhileCleaningDialogOpen, setIsManualCreateWhileCleaningDialogOpen] = useState(false);
  const [isReplaceImageWarningOpen, setIsReplaceImageWarningOpen] = useState(false);
  const [selectedImageKind, setSelectedImageKind] =
    useState<ExpandedImageEditorApplyContext["imageKind"]>("base");
  const [manualUndoHistory, setManualUndoHistory] = useState<ManualCreateUndoSnapshot[]>([]);
  const [manualRedoHistory, setManualRedoHistory] = useState<ManualCreateUndoSnapshot[]>([]);
  const [detectionUndoHistory, setDetectionUndoHistory] = useState<DetectionDraftHistory>({});
  const [detectionRedoHistory, setDetectionRedoHistory] = useState<DetectionDraftHistory>({});
  const [outfitUploads, setOutfitUploads] = useState<OutfitUpload[]>([]);
  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
  const [selectedImageKinds, setSelectedImageKinds] = useState<
    ExpandedImageEditorApplyContext["imageKind"][]
  >([]);
  const [originalSelectedImageFiles, setOriginalSelectedImageFiles] = useState<File[]>([]);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [pendingReplacementFiles, setPendingReplacementFiles] = useState<File[]>([]);
  const [pendingReplacementActiveIndex, setPendingReplacementActiveIndex] = useState(0);
  const [selectedDetectionIds, setSelectedDetectionIds] = useState<number[]>([]);
  const [cleaningDetectionIds, setCleaningDetectionIds] = useState<number[]>([]);
  const [detectionCleanErrors, setDetectionCleanErrors] = useState<Record<number, string>>({});
  const [editedDetections, setEditedDetections] = useState<Record<number, ClothingItemFormValues>>(
    {},
  );
  const [editedDetectionPhotos, setEditedDetectionPhotos] = useState<
    Record<number, { file: File; imageKind: ExpandedImageEditorApplyContext["imageKind"] }>
  >({});
  const photoState = useItemPhotoState();

  const shouldUseInitialUser = Boolean(userId && initialUser?.id === userId);
  const {
    data: user,
    errorMessage,
    isLoading,
    setErrorMessage,
  } = usePageData<User | null>({
    deps: [initialUser, shouldUseInitialUser, userId],
    enabled: Boolean(userId),
    getErrorMessage: (error) =>
      error instanceof Error ? error.message : "Unable to load this user.",
    initialData: shouldUseInitialUser ? initialUser ?? null : null,
    load: (signal) => fetchUser(userId!, signal),
    shouldUseInitialData: shouldUseInitialUser,
  });

  const isImageMode = initialMode === "image";
  const closetSuggestions = collectClosetSuggestions(user?.clothing_items ?? []);
  const selectedImageUrls = useFileObjectUrls(selectedImageFiles);
  const activeLocalSourceFile = selectedImageFiles[activeSourceIndex] ?? null;
  const activeRestoredUpload = outfitUploads[activeSourceIndex] ?? outfitUploads[0] ?? null;
  const sourceImageUrl = photoState.imageUrl
    ?? selectedImageUrls[activeSourceIndex]
    ?? activeRestoredUpload?.source_photo_url
    ?? null;
  const sourceImages = selectedImageFiles.length > 0
    ? selectedImageFiles.map((file, index) => ({
        id: `local-${index}-${file.name}-${file.lastModified}`,
        imageUrl: selectedImageUrls[index] ?? null,
        label: file.name,
      }))
    : outfitUploads.map((upload, index) => ({
        id: `upload-${upload.id}`,
        imageUrl: upload.source_photo_url ?? null,
        label: `Photo ${index + 1}`,
      }));
  const detections = outfitUploads.flatMap((upload) => upload.detections);
  const selectedDetections = detections.filter((detection) => selectedDetectionIds.includes(detection.id));
  const selectedCount = selectedDetections.length;
  const selectedFileCount = Math.max(
    selectedImageFiles.length,
    outfitUploads.length,
    initialOutfitUploadIds.length,
  );
  const completedFileCount = outfitUploads.filter((upload) =>
    ["succeeded", "failed", "cancelled"].includes(upload.status),
  ).length;
  const selectedFileName = activeLocalSourceFile?.name
    ?? (activeRestoredUpload ? `Photo ${activeSourceIndex + 1}` : undefined);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortDetectionPolling();
    };
  }, []);

  function abortDetectionPolling() {
    detectionPollControllersRef.current.forEach((controller) => controller.abort());
    detectionPollControllersRef.current.clear();
  }

  function upsertOutfitUpload(nextUpload: OutfitUpload) {
    setOutfitUploads((current) => {
      const existingIndex = current.findIndex((upload) => upload.id === nextUpload.id);
      if (existingIndex < 0) {
        return [...current, nextUpload];
      }

      return current.map((upload, index) => (index === existingIndex ? nextUpload : upload));
    });
  }

  function getDetectionSourceImageUrl(detection: OutfitDetection) {
    return outfitUploads.find((upload) => upload.id === detection.outfit_upload_id)?.source_photo_url
      ?? null;
  }

  function resetDetectionState() {
    detectionMetadataRunRef.current += 1;
    preparingMetadataRunsRef.current = 0;
    setOutfitUploads([]);
    setSelectedDetectionIds([]);
    setCleaningDetectionIds([]);
    setDetectionCleanErrors({});
    setEditedDetections({});
    setEditedDetectionPhotos({});
    setDetectionUndoHistory({});
    setDetectionRedoHistory({});
    setAutofillingDetectionId(null);
    setIsPreparingDetectedMetadata(false);
  }

  async function autoAttachCleanedPhotoToCreatedItem({
    cleanedFilePromise,
    createdItem,
    values,
  }: {
    cleanedFilePromise: Promise<File>;
    createdItem: ClothingItem;
    values: ClothingItemFormValues;
  }) {
    try {
      const cleanedPreview = await cleanedFilePromise;
      await saveClothingItem(createdItem.id, createdItem.user_id, values, {
        cleanedPhoto: cleanedPreview,
      });
    } catch {
      // The item has already been created; keep this background attachment best-effort.
    }
  }

  function captureManualUndoSnapshot(): ManualCreateUndoSnapshot {
    return {
      formValues: { ...formValues },
      originalUploadedPhoto: originalUploadedPhotoRef.current,
      photoState: photoState.getSnapshot(),
      selectedImageKind,
    };
  }

  function pushManualUndoSnapshot(snapshot: ManualCreateUndoSnapshot = captureManualUndoSnapshot()) {
    setManualUndoHistory((current) => [...current, snapshot]);
    setManualRedoHistory([]);
  }

  function restoreManualSnapshot(snapshot: ManualCreateUndoSnapshot) {
    setFormValues({ ...snapshot.formValues });
    setFieldErrors(validateClothingItemForm(snapshot.formValues));
    originalUploadedPhotoRef.current = snapshot.originalUploadedPhoto;
    photoState.restoreSnapshot(snapshot.photoState);
    setSelectedImageKind(snapshot.selectedImageKind);
    setErrorMessage("");
  }

  function handleManualUndo() {
    const snapshot = manualUndoHistory[manualUndoHistory.length - 1];
    if (!snapshot) {
      return;
    }

    const currentSnapshot = captureManualUndoSnapshot();
    setManualUndoHistory((current) => current.slice(0, -1));
    setManualRedoHistory((current) => [...current, currentSnapshot]);
    restoreManualSnapshot(snapshot);
  }

  function handleManualRedo() {
    const snapshot = manualRedoHistory[manualRedoHistory.length - 1];
    if (!snapshot) {
      return;
    }

    const currentSnapshot = captureManualUndoSnapshot();
    setManualRedoHistory((current) => current.slice(0, -1));
    setManualUndoHistory((current) => [...current, currentSnapshot]);
    restoreManualSnapshot(snapshot);
  }

  function applyImageFileSelection(
    file: File,
    imageKind: ExpandedImageEditorApplyContext["imageKind"] = "base",
  ) {
    pushManualUndoSnapshot();
    abortDetectionPolling();
    if (imageKind === "base" || !originalUploadedPhotoRef.current) {
      originalUploadedPhotoRef.current = file;
    }
    setSelectedImageFiles([file]);
    setSelectedImageKind(imageKind);
    photoState.updateSelectedFile(file);
    resetDetectionState();
    setErrorMessage("");
  }

  function focusSourceImage(
    index: number,
    files = selectedImageFiles,
    imageKinds = selectedImageKinds,
    originalFiles = originalSelectedImageFiles,
  ) {
    const boundedIndex = Math.max(0, Math.min(index, Math.max(0, files.length - 1)));
    const file = files[boundedIndex] ?? null;

    setActiveSourceIndex(boundedIndex);
    setSelectedImageKind(imageKinds[boundedIndex] ?? "base");
    originalUploadedPhotoRef.current = originalFiles[boundedIndex] ?? file;
    photoState.updateSelectedFile(file);
  }

  function applyImageFilesSelection(files: File[], nextActiveIndex = 0) {
    if (files.length === 0) {
      return;
    }

    pushManualUndoSnapshot();
    abortDetectionPolling();
    const imageKinds = files.map(() => "base" as const);
    setSelectedImageFiles(files);
    setSelectedImageKinds(imageKinds);
    setOriginalSelectedImageFiles(files);
    focusSourceImage(nextActiveIndex, files, imageKinds, files);
    resetDetectionState();
    setErrorMessage("");
  }

  function replaceActiveSourceImage(file: File) {
    const nextFiles = [...selectedImageFiles];
    if (nextFiles.length === 0) {
      if (outfitUploads.length > 0) {
        setPendingReplacementFiles([file]);
        setPendingReplacementActiveIndex(0);
        setIsReplaceImageWarningOpen(true);
        return;
      }
      applyImageFilesSelection([file]);
      return;
    }

    nextFiles[activeSourceIndex] = file;
    if (outfitUploads.length > 0) {
      setPendingReplacementFiles(nextFiles);
      setPendingReplacementActiveIndex(activeSourceIndex);
      setIsReplaceImageWarningOpen(true);
      return;
    }

    applyImageFilesSelection(nextFiles, activeSourceIndex);
  }

  function removeActiveSourceImage() {
    if (selectedImageFiles.length <= 1) {
      clearImageSelection();
      return;
    }

    const nextFiles = selectedImageFiles.filter((_, index) => index !== activeSourceIndex);
    const nextImageKinds = selectedImageKinds.filter((_, index) => index !== activeSourceIndex);
    const nextOriginalFiles = originalSelectedImageFiles.filter((_, index) => index !== activeSourceIndex);
    const nextActiveIndex = Math.min(activeSourceIndex, nextFiles.length - 1);

    abortDetectionPolling();
    setSelectedImageFiles(nextFiles);
    setSelectedImageKinds(nextImageKinds);
    setOriginalSelectedImageFiles(nextOriginalFiles);
    focusSourceImage(nextActiveIndex, nextFiles, nextImageKinds, nextOriginalFiles);
    resetDetectionState();
    setErrorMessage("");
  }

  function applyActiveSourceImageEdits(
    file: File,
    context: ExpandedImageEditorApplyContext,
  ) {
    if (!selectedImageFiles[activeSourceIndex]) {
      return;
    }

    const nextFiles = [...selectedImageFiles];
    const nextImageKinds = [...selectedImageKinds];
    const nextOriginalFiles = [...originalSelectedImageFiles];
    nextFiles[activeSourceIndex] = file;
    nextImageKinds[activeSourceIndex] = context.imageKind;
    if (context.imageKind === "base" || !nextOriginalFiles[activeSourceIndex]) {
      nextOriginalFiles[activeSourceIndex] = file;
    }

    abortDetectionPolling();
    setSelectedImageFiles(nextFiles);
    setSelectedImageKinds(nextImageKinds);
    setOriginalSelectedImageFiles(nextOriginalFiles);
    focusSourceImage(activeSourceIndex, nextFiles, nextImageKinds, nextOriginalFiles);
    resetDetectionState();
    setErrorMessage("");
  }

  function closeReplaceImageWarning(open: boolean) {
    setIsReplaceImageWarningOpen(open);

    if (!open) {
      setPendingReplacementFiles([]);
      setPendingReplacementActiveIndex(0);
      if (photoState.inputRef.current) {
        photoState.inputRef.current.value = "";
      }
    }
  }

  function confirmReplaceImage() {
    if (pendingReplacementFiles.length > 0) {
      applyImageFilesSelection(pendingReplacementFiles, pendingReplacementActiveIndex);
    }

    setPendingReplacementFiles([]);
    setPendingReplacementActiveIndex(0);
    setIsReplaceImageWarningOpen(false);
  }

  async function waitForOutfitUpload(
    uploadId: number,
    signal: AbortSignal,
    detectionRunId = detectionMetadataRunRef.current,
  ) {
    const startedAt = Date.now();

    while (!signal.aborted) {
      const nextUpload = await fetchOutfitUpload(uploadId, signal);
      if (detectionMetadataRunRef.current !== detectionRunId) {
        throw new DOMException("Aborted", "AbortError");
      }
      upsertOutfitUpload(nextUpload);

      if (["succeeded", "failed", "cancelled"].includes(nextUpload.status)) {
        return nextUpload;
      }

      if (Date.now() - startedAt >= 90_000) {
        throw new Error("Detection is taking longer than expected. Please check back in a moment.");
      }

      await new Promise<void>((resolve, reject) => {
        const timeoutId = window.setTimeout(resolve, 1500);
        const abortHandler = () => {
          window.clearTimeout(timeoutId);
          reject(new DOMException("Aborted", "AbortError"));
        };

        signal.addEventListener("abort", abortHandler, { once: true });
      });
    }

    throw new DOMException("Aborted", "AbortError");
  }

  useEffect(() => {
    const uploadIdsToResume = initialOutfitUploadIds.filter((uploadId) => (
      uploadId > 0 && !resumedOutfitUploadIdsRef.current.has(uploadId)
    ));
    if (uploadIdsToResume.length === 0) {
      return;
    }

    uploadIdsToResume.forEach((uploadId) => resumedOutfitUploadIdsRef.current.add(uploadId));
    const detectionRunId = detectionMetadataRunRef.current;

    void (async () => {
      setIsDetecting(true);
      setErrorMessage("");

      const results = await mapWithConcurrency(uploadIdsToResume, 3, async (uploadId) => {
        const controller = new AbortController();
        detectionPollControllersRef.current.set(uploadId, controller);

        try {
          let restoredUpload = await fetchOutfitUpload(uploadId, controller.signal);
          if (detectionMetadataRunRef.current !== detectionRunId) {
            throw new DOMException("Aborted", "AbortError");
          }
          upsertOutfitUpload(restoredUpload);

          if (["pending", "processing"].includes(restoredUpload.status)) {
            restoredUpload = await waitForOutfitUpload(
              restoredUpload.id,
              controller.signal,
              detectionRunId,
            );
          }
          if (detectionMetadataRunRef.current !== detectionRunId) {
            throw new DOMException("Aborted", "AbortError");
          }

          if (restoredUpload.status === "failed") {
            throw new Error(restoredUpload.error_message || "Unable to analyze one of these photos.");
          }
          if (restoredUpload.status === "succeeded") {
            void autofillDetectedMetadata(restoredUpload.detections);
          }

          return restoredUpload;
        } finally {
          detectionPollControllersRef.current.delete(uploadId);
        }
      });

      if (detectionMetadataRunRef.current !== detectionRunId) {
        return;
      }

      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length > 0) {
        setErrorMessage(
          failures.length === uploadIdsToResume.length
            ? "Unable to restore these analyzed photos."
            : `${failures.length} photo${failures.length === 1 ? "" : "s"} could not be restored. The successful results are still available.`,
        );
      }
      setIsDetecting(false);
    })();

  }, [initialOutfitUploadIds.join(",")]);

  async function detectItems(files: File[]) {
    if (!userId) {
      setErrorMessage("A user is required before you can upload from an image.");
      return;
    }
    if (files.length === 0) {
      return;
    }

    setIsDetecting(true);
    setErrorMessage("");
    abortDetectionPolling();
    resetDetectionState();
    const detectionRunId = detectionMetadataRunRef.current;

    const completionPromises: Promise<PromiseSettledResult<OutfitUpload>>[] = [];
    const uploadResults = await mapWithConcurrency(files, 3, async (file) => {
      let nextUpload = await createOutfitUpload(userId, { photo: file });
      resumedOutfitUploadIdsRef.current.add(nextUpload.id);
      if (nextUpload.ai_workflow) {
        onGenerationTaskStarted(nextUpload.ai_workflow, file.name);
      }
      if (detectionMetadataRunRef.current !== detectionRunId) {
        return nextUpload;
      }

      upsertOutfitUpload(nextUpload);

      const completionPromise = (async () => {
        if (!isMountedRef.current || detectionMetadataRunRef.current !== detectionRunId) {
          return nextUpload;
        }

        const controller = new AbortController();
        detectionPollControllersRef.current.set(nextUpload.id, controller);

        try {
          if (["pending", "processing"].includes(nextUpload.status)) {
            nextUpload = await waitForOutfitUpload(
              nextUpload.id,
              controller.signal,
              detectionRunId,
            );
          }
          if (detectionMetadataRunRef.current !== detectionRunId) {
            throw new DOMException("Aborted", "AbortError");
          }

          if (nextUpload.status === "failed") {
            throw new Error(nextUpload.error_message || `Unable to analyze ${file.name}.`);
          }
          if (nextUpload.status === "cancelled") {
            throw new DOMException("Aborted", "AbortError");
          }
          if (nextUpload.status === "succeeded") {
            void autofillDetectedMetadata(nextUpload.detections);
          }

          return nextUpload;
        } finally {
          detectionPollControllersRef.current.delete(nextUpload.id);
        }
      })();
      completionPromises.push(completionPromise.then(
        (value): PromiseSettledResult<OutfitUpload> => ({ status: "fulfilled", value }),
        (reason): PromiseSettledResult<OutfitUpload> => ({ status: "rejected", reason }),
      ));

      return nextUpload;
    });

    const completionResults = await Promise.all(completionPromises);
    if (detectionMetadataRunRef.current !== detectionRunId) {
      return;
    }

    const failures = [
      ...uploadResults.filter((result) => result.status === "rejected"),
      ...completionResults.filter((result) => result.status === "rejected"),
    ];
    const nonAbortFailures = failures.filter((result) => !(
      result.status === "rejected"
      && result.reason instanceof DOMException
      && result.reason.name === "AbortError"
    ));
    if (nonAbortFailures.length > 0) {
      setErrorMessage(
        nonAbortFailures.length === files.length
          ? "Unable to analyze these photos."
          : `${nonAbortFailures.length} photo${nonAbortFailures.length === 1 ? "" : "s"} could not be analyzed. The successful results are ready below.`,
      );
    }
    setIsDetecting(false);
  }

  function handleImageFileChange(files: File[]) {
    if (files.length === 0) {
      return;
    }

    const shouldWarnBeforeReplacingImage = isImageMode && outfitUploads.length > 0;

    if (shouldWarnBeforeReplacingImage) {
      setPendingReplacementFiles(files);
      setPendingReplacementActiveIndex(0);
      setIsReplaceImageWarningOpen(true);
      return;
    }

    applyImageFilesSelection(files);
  }

  function clearImageSelection() {
    if (photoState.selectedFile || originalUploadedPhotoRef.current || selectedImageKind !== "base") {
      pushManualUndoSnapshot();
    }
    abortDetectionPolling();
    originalUploadedPhotoRef.current = null;
    setSelectedImageFiles([]);
    setSelectedImageKinds([]);
    setOriginalSelectedImageFiles([]);
    setActiveSourceIndex(0);
    setSelectedImageKind("base");
    photoState.clearSelectedFile();
    resetDetectionState();
    setErrorMessage("");
  }

  function toggleDetectionSelection(detection: OutfitDetection) {
    if (!detection.final_box && !detection.refined_box && !detection.coarse_box && !detection.bounding_box) {
      return;
    }

    setSelectedDetectionIds((current) =>
      current.includes(detection.id)
        ? current.filter((id) => id !== detection.id)
        : [...current, detection.id],
    );
  }

  function getDetectionDraft(detection: OutfitDetection) {
    return editedDetections[detection.id] ?? toClothingItemFormValuesFromDetection(detection);
  }

  function hasDetectionDraft(detectionId: number) {
    return Boolean(editedDetections[detectionId]);
  }

  function updateDetectionDraft(detectionId: number, nextValues: ClothingItemFormValues) {
    const detection = detections.find((entry) => entry.id === detectionId);
    if (!detection) {
      return;
    }

    const previousValues = getDetectionDraft(detection);
    if (JSON.stringify(previousValues) === JSON.stringify(nextValues)) {
      return;
    }

    setDetectionUndoHistory((current) => ({
      ...current,
      [detectionId]: [...(current[detectionId] ?? []), previousValues],
    }));
    setDetectionRedoHistory((current) => ({
      ...current,
      [detectionId]: [],
    }));
    setEditedDetections((current) => ({
      ...current,
      [detectionId]: nextValues,
    }));
  }

  function setDetectionDraftValues(detection: OutfitDetection, nextValues: ClothingItemFormValues) {
    setEditedDetections((current) => ({
      ...current,
      [detection.id]: nextValues,
    }));
  }

  function handleDetectionUndo(detection: OutfitDetection) {
    const previousValues = detectionUndoHistory[detection.id]?.[detectionUndoHistory[detection.id].length - 1];
    if (!previousValues) {
      return;
    }

    const currentValues = getDetectionDraft(detection);
    setDetectionUndoHistory((current) => ({
      ...current,
      [detection.id]: (current[detection.id] ?? []).slice(0, -1),
    }));
    setDetectionRedoHistory((current) => ({
      ...current,
      [detection.id]: [...(current[detection.id] ?? []), currentValues],
    }));
    setDetectionDraftValues(detection, previousValues);
  }

  function handleDetectionRedo(detection: OutfitDetection) {
    const nextValues = detectionRedoHistory[detection.id]?.[detectionRedoHistory[detection.id].length - 1];
    if (!nextValues) {
      return;
    }

    const currentValues = getDetectionDraft(detection);
    setDetectionRedoHistory((current) => ({
      ...current,
      [detection.id]: (current[detection.id] ?? []).slice(0, -1),
    }));
    setDetectionUndoHistory((current) => ({
      ...current,
      [detection.id]: [...(current[detection.id] ?? []), currentValues],
    }));
    setDetectionDraftValues(detection, nextValues);
  }

  async function handleCleanUploadedPhoto() {
    if (!photoState.selectedFile) {
      setErrorMessage("Upload a photo before using the AI cleaner.");
      return;
    }

    pushManualUndoSnapshot();
    setIsCleaningUploadedPhoto(true);
    setErrorMessage("");

    const cleanPromise = createCleanPreviewFile(photoState.selectedFile, {
      metadata: formValues,
      originalSourcePhoto: originalUploadedPhotoRef.current,
    });
    pendingManualCleanPromiseRef.current = cleanPromise;
    pendingManualCleanModeRef.current = "preview";

    try {
      const cleanedFile = await cleanPromise;
      if (pendingManualCleanModeRef.current === "preview") {
        setSelectedImageKind("cleaned");
        photoState.updateSelectedFile(cleanedFile);
      }
    } catch (error) {
      if ((pendingManualCleanModeRef.current as "preview" | "attach" | "ignore") !== "ignore") {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to create an AI-cleaned item image.",
        );
      }
    } finally {
      if (pendingManualCleanPromiseRef.current === cleanPromise) {
        pendingManualCleanPromiseRef.current = null;
        pendingManualCleanModeRef.current = "preview";
        setIsCleaningUploadedPhoto(false);
      }
    }
  }

  async function handleAutofillManualMetadata() {
    if (!photoState.selectedFile) {
      setErrorMessage("Upload a photo before using AI autofill.");
      return;
    }

    setIsAutofillingMetadata(true);
    setErrorMessage("");

    try {
      const suggestion = await previewMetadataSuggestions(photoState.selectedFile, undefined, {
        metadata: formValues,
        originalSourcePhoto: originalUploadedPhotoRef.current,
      });
      pushManualUndoSnapshot();
      setFormValues((current) => mergeMetadataSuggestion(current, suggestion));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to autofill this item's metadata.",
      );
    } finally {
      setIsAutofillingMetadata(false);
    }
  }

  async function getPreviewEditorFile() {
    return photoState.selectedFile;
  }

  async function createPreviewEditorCleanImage(file: File) {
    return createCleanPreviewFile(file, {
      metadata: formValues,
      originalSourcePhoto: originalUploadedPhotoRef.current,
    });
  }

  async function getDetectionEditorFile(detection: OutfitDetection) {
    const editedPhoto = editedDetectionPhotos[detection.id];
    if (editedPhoto) {
      return editedPhoto.file;
    }

    const suggestedName = detection.suggested_name?.trim() || detection.category || "detected-item";
    if (detection.cleaned_image_url) {
      return fetchImageFileFromUrl(detection.cleaned_image_url, `${suggestedName}-edited.png`);
    }

    const detectionBox = preferredDetectionBox(detection);
    const detectionSourceImageUrl = getDetectionSourceImageUrl(detection);
    if (!detectionSourceImageUrl || !detectionBox) {
      return null;
    }

    const sourceFile = await fetchImageFileFromUrl(
      detectionSourceImageUrl,
      `${suggestedName}-source.png`,
    );
    return cropDetectionImageFile(sourceFile, detectionBox, `${suggestedName}-detected.png`);
  }

  async function createDetectionEditorCleanImage(detection: OutfitDetection, file: File) {
    return createCleanPreviewFile(file, {
      metadata: getDetectionDraft(detection),
    });
  }

  async function createManualItem(cleaningStrategy: "current" | "attach-when-ready" = "current") {
    if (!userId) {
      setErrorMessage("A user is required before you can create an item.");
      return;
    }

    const valuesSnapshot = { ...formValues };
    const cleaningPromise = pendingManualCleanPromiseRef.current;
    if (cleaningPromise) {
      pendingManualCleanModeRef.current =
        cleaningStrategy === "attach-when-ready" ? "attach" : "ignore";
    }

    setIsCreating(true);
    setErrorMessage("");

    try {
      const photoOptions = photoState.selectedFile
        ? selectedImageKind === "base"
          ? { photo: photoState.selectedFile }
          : { cleanedPhoto: photoState.selectedFile }
        : {};
      const createdItem = await createClothingItem(userId, valuesSnapshot, {
        ...photoOptions,
      });

      if (cleaningStrategy === "attach-when-ready" && cleaningPromise) {
        void autoAttachCleanedPhotoToCreatedItem({
          cleanedFilePromise: cleaningPromise,
          createdItem,
          values: valuesSnapshot,
        });
      }

      onItemsCreated([createdItem]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create this clothing item.");
      setIsCreating(false);
      pendingManualCleanModeRef.current = "preview";
    }
  }

  function applyDetectionImageEdits(
    detection: OutfitDetection,
    file: File,
    context: ExpandedImageEditorApplyContext,
  ) {
    setEditedDetectionPhotos((current) => ({
      ...current,
      [detection.id]: {
        file,
        imageKind: context.imageKind,
      },
    }));
    setDetectionCleanErrors((current) => {
      const next = { ...current };
      delete next[detection.id];
      return next;
    });
  }

  async function handleAutofillDetectionMetadata(detection: OutfitDetection) {
    setAutofillingDetectionId(detection.id);
    setErrorMessage("");

    try {
      const suggestion = await generateOutfitDetectionMetadataSuggestions(
        detection.id,
        getDetectionDraft(detection),
      );
      updateDetectionDraft(
        detection.id,
        mergeMetadataSuggestion(getDetectionDraft(detection), suggestion),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to autofill this detected item's metadata.",
      );
    } finally {
      setAutofillingDetectionId(null);
    }
  }

  async function autofillDetectedMetadata(nextDetections: OutfitDetection[]) {
    setEditedDetections((current) => {
      const next = { ...current };
      nextDetections.forEach((detection) => {
        next[detection.id] ??= toClothingItemFormValuesFromDetection(detection);
      });
      return next;
    });

    const detectionIdsToAutofill = nextDetections
      .filter((detection) => Boolean(detection.cleaned_image_url || preferredDetectionBox(detection)))
      .map((detection) => detection.id);

    if (detectionIdsToAutofill.length === 0) {
      return;
    }

    const runId = detectionMetadataRunRef.current;
    preparingMetadataRunsRef.current += 1;
    setIsPreparingDetectedMetadata(true);

    try {
      for (const detection of nextDetections) {
        if (!detectionIdsToAutofill.includes(detection.id)) {
          continue;
        }

        setAutofillingDetectionId(detection.id);

        try {
          const suggestion = await generateOutfitDetectionMetadataSuggestions(detection.id);
          if (detectionMetadataRunRef.current !== runId) {
            return;
          }

          setEditedDetections((current) => ({
            ...current,
            [detection.id]: mergeMetadataSuggestion(
              current[detection.id] ?? toClothingItemFormValuesFromDetection(detection),
              suggestion,
            ),
          }));
        } catch {
          if (detectionMetadataRunRef.current !== runId) {
            return;
          }
        } finally {
          if (detectionMetadataRunRef.current === runId) {
            setAutofillingDetectionId((current) => (current === detection.id ? null : current));
          }
        }
      }
    } finally {
      if (detectionMetadataRunRef.current === runId) {
        preparingMetadataRunsRef.current = Math.max(0, preparingMetadataRunsRef.current - 1);
        setIsPreparingDetectedMetadata(preparingMetadataRunsRef.current > 0);
      }
    }
  }

  function focusFirstInvalidField(errors: ClothingItemFormErrors) {
    const firstField = firstInvalidClothingItemField(errors);
    if (!firstField) {
      return;
    }

    document.getElementById(clothingItemFieldElementId(firstField))?.focus();
  }

  async function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setErrorMessage("A user is required before you can create an item.");
      return;
    }

    const validationErrors = validateClothingItemForm(formValues);
    setFieldErrors(validationErrors);

    if (hasClothingItemFormErrors(validationErrors)) {
      focusFirstInvalidField(validationErrors);
      return;
    }

    if (isCleaningUploadedPhoto && pendingManualCleanPromiseRef.current) {
      setIsManualCreateWhileCleaningDialogOpen(true);
      return;
    }

    await createManualItem();
  }

  const manualUndoDisabled = isImageMode || isCreating || isCleaningUploadedPhoto || isAutofillingMetadata;
  const canManualUndo = manualUndoHistory.length > 0;
  const canManualRedo = manualRedoHistory.length > 0;

  useUndoRedoShortcuts({
    canRedo: canManualRedo,
    canUndo: canManualUndo,
    disabled: manualUndoDisabled,
    onRedo: handleManualRedo,
    onUndo: handleManualUndo,
  });

  async function handleSaveSelectedItems() {
    if (!userId) {
      setErrorMessage("A user is required before you can save items to the closet.");
      return;
    }

    if (selectedDetections.length === 0) {
      setErrorMessage("Choose at least one verified detected item to add to the closet.");
      return;
    }

    for (const detection of selectedDetections) {
      const draft = getDetectionDraft(detection);
      const validationErrors = validateClothingItemForm(draft);

      if (hasClothingItemFormErrors(validationErrors)) {
        setErrorMessage(
          `Fix the details for "${draft.name.trim() || detection.suggested_name || "detected item"}" before saving.`,
        );
        return;
      }
    }

    setIsCreating(true);
    setErrorMessage("");

    try {
      const createdItems: ClothingItem[] = [];

      for (const detection of selectedDetections) {
        const editedPhoto = editedDetectionPhotos[detection.id] ?? null;
        const createdItem = await createClothingItem(userId, getDetectionDraft(detection), {
          photo: editedPhoto?.imageKind === "base" ? editedPhoto.file : undefined,
          cleanedPhoto: editedPhoto && editedPhoto.imageKind !== "base" ? editedPhoto.file : undefined,
          sourceOutfitDetectionId: detection.id,
        });
        createdItems.push(createdItem);
      }

      onItemsCreated(createdItems);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save the selected items to the closet.",
      );
      setIsCreating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="animate-pulse grid lg:grid-cols-[1.1fr_1fr] gap-10">
          <div className="aspect-[4/5] bg-muted" />
          <div className="space-y-4">
            <div className="h-12 bg-muted w-2/3" />
            <div className="h-4 bg-muted w-1/3" />
            <div className="h-48 bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <PrimitiveButton
          onClick={onBack}
          variant="outline"
          className="mb-8 h-auto px-5 py-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </PrimitiveButton>
        <div className="border border-destructive/20 bg-destructive/5 p-6">
          <PrimitiveText as="p" variant="title" font="serif" className="mb-2">
            A user is required before you can add an item.
          </PrimitiveText>
          <PrimitiveText as="p" tone="muted">
            {errorMessage || "Pick a valid user and try again."}
          </PrimitiveText>
        </div>
      </div>
    );
  }

  if (isImageMode) {
    return (
      <>
        <CreateItemImageMode
          autofillingDetectionId={autofillingDetectionId}
          brandSuggestions={closetSuggestions.brandSuggestions}
          canRedoDetectionDraft={(detectionId) => (detectionRedoHistory[detectionId]?.length ?? 0) > 0}
          canUndoDetectionDraft={(detectionId) => (detectionUndoHistory[detectionId]?.length ?? 0) > 0}
          cleaningDetectionIds={cleaningDetectionIds}
          detectionCleanErrors={detectionCleanErrors}
          detections={detections}
          errorMessage={errorMessage}
          getDetectionDraft={getDetectionDraft}
          hasDetectionDraft={hasDetectionDraft}
          inputRef={photoState.inputRef}
          isPreparingDetectedMetadata={isPreparingDetectedMetadata}
          isCreating={isCreating}
          isDetecting={isDetecting}
          completedFileCount={completedFileCount}
          getDetectionSourceImageUrl={getDetectionSourceImageUrl}
          hasOutfitUploads={outfitUploads.length > 0}
          onBack={onBack}
          onRemoveSourceImage={removeActiveSourceImage}
          onReplaceSourceImage={replaceActiveSourceImage}
          onSelectSourceImage={(index) => focusSourceImage(index)}
          onDetectItems={() => void detectItems(selectedImageFiles)}
          onDraftChange={updateDetectionDraft}
          getDetectionEditedImageFile={(detection) => editedDetectionPhotos[detection.id]?.file ?? null}
          getDetectionEditedImageKind={(detection) => editedDetectionPhotos[detection.id]?.imageKind ?? null}
          onApplyDetectionImageEdits={applyDetectionImageEdits}
          onCleanDetectionEditorImage={(detection, file) => createDetectionEditorCleanImage(detection, file)}
          onGetDetectionImageEditorFile={getDetectionEditorFile}
          onRedoDetectionDraft={handleDetectionRedo}
          onApplySourceImageEdits={applyActiveSourceImageEdits}
          onGetSourceImageEditorFile={getPreviewEditorFile}
          onRequestDetectionAutofill={(detection) => void handleAutofillDetectionMetadata(detection)}
          onFileChange={handleImageFileChange}
          onSaveSelectedItems={() => void handleSaveSelectedItems()}
          onToggleSelection={toggleDetectionSelection}
          onUndoDetectionDraft={handleDetectionUndo}
          selectedCount={selectedCount}
          selectedDetectionIds={selectedDetectionIds}
          selectedSourceIndex={activeSourceIndex}
          selectedFileCount={selectedFileCount}
          selectedFileName={selectedFileName}
          sourceImageEditorActions={{
            initialKind: selectedImageKind,
            onClean: createPreviewEditorCleanImage,
          }}
          sourceImageUrl={sourceImageUrl}
          sourceImages={sourceImages}
          tagSuggestions={closetSuggestions.tagSuggestions}
          user={user}
        />
        <PrimitiveConfirmationDialog
          description="Uploading new photos will discard all currently detected items. Proceed?"
          onConfirm={confirmReplaceImage}
          onOpenChange={closeReplaceImageWarning}
          open={isReplaceImageWarningOpen}
        />
      </>
    );
  }

  const previewName = formValues.name.trim() || "Untitled Item";
  const previewMetadata = buildItemPreviewMetadata(parseTagInput(formValues.tags));

  return (
    <ItemEditorWorkspace
      backLabel="Back"
      formLabel="Add Item"
      formTopAction={
        <div className="flex items-center gap-2">
          <PrimitiveButton
            type="button"
            onClick={handleManualUndo}
            disabled={!canManualUndo || manualUndoDisabled}
            variant="outline"
            size="sm"
            aria-label="Undo last unsaved change"
          >
            <RotateCcw className="w-4 h-4" />
            Undo
          </PrimitiveButton>
          <PrimitiveButton
            type="button"
            onClick={handleManualRedo}
            disabled={!canManualRedo || manualUndoDisabled}
            variant="outline"
            size="sm"
            aria-label="Redo last unsaved change"
          >
            <RotateCw className="w-4 h-4" />
            Redo
          </PrimitiveButton>
        </div>
      }
      imageUrl={photoState.imageUrl}
      onBack={onBack}
      onPreviewClick={() => photoState.inputRef.current?.click()}
      onPreviewClear={clearImageSelection}
      onPreviewEdit={() => photoState.inputRef.current?.click()}
      previewEditor={photoState.selectedFile ? {
        getEditableFile: getPreviewEditorFile,
        imageActions: {
          initialKind: selectedImageKind,
          onClean: createPreviewEditorCleanImage,
        },
        onApply: (file, context) => {
          applyImageFileSelection(file, context.imageKind);
        },
        sourceKey: photoState.imageUrl ?? `manual-upload-${photoState.selectedFile.name}-${photoState.selectedFile.lastModified}`,
      } : undefined}
      onSubmit={handleManualSubmit}
      previewAriaLabel={photoState.selectedFile ? "Preview image" : "Upload photo"}
      previewBackgroundDecoration={
        <Upload
          className="h-40 w-40 text-stone-700/18 sm:h-52 sm:w-52"
          strokeWidth={1.1}
        />
      }
      isPreviewProcessing={isCleaningUploadedPhoto}
      previewTopAction={
        <AiCleanImageButton
          className="size-11 border border-white/75 shadow-sm bg-white/70 p-0 backdrop-blur-sm hover:bg-white/85"
          disabled={!photoState.selectedFile}
          iconOnly
          isLoading={isCleaningUploadedPhoto}
          label="AI clean PNG"
          onClick={() => void handleCleanUploadedPhoto()}
        />
      }
      previewLabel="New Clothing Item"
      previewPrimaryDetail={previewMetadata}
      previewTitle={previewName}
      footer={
        <div className="mt-auto pt-2 flex items-center justify-end">
          <PrimitiveButton
            type="submit"
            disabled={isCreating}
            className="h-auto bg-foreground px-5 py-3 text-background hover:bg-foreground/90"
          >
            <Plus className="w-4 h-4" />
            {isCreating ? "Creating..." : "Create Item"}
          </PrimitiveButton>
        </div>
      }
    >
      <input
        ref={photoState.inputRef}
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            applyImageFileSelection(file);
          }
        }}
        className="sr-only"
      />

      {errorMessage && (
        <div className="border border-destructive/20 bg-destructive/5 p-4 text-sm" role="alert" aria-live="assertive">
          {errorMessage}
        </div>
      )}

      <ItemMetadataPanel
        action={
          <AiMetadataAutofillButton
            className="mt-0.5 h-9 w-9 shrink-0 self-start"
            disabled={!photoState.selectedFile}
            isLoading={isAutofillingMetadata}
            label="AI autofill type, name, brand, and tags"
            onClick={() => void handleAutofillManualMetadata()}
          />
        }
        category={formValues.category}
        title={previewName}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <ItemMetadataFields
            brandSuggestions={closetSuggestions.brandSuggestions}
            errors={fieldErrors}
            isAutofilling={isAutofillingMetadata}
            onChange={(nextValues) => {
              pushManualUndoSnapshot();
              setFormValues(nextValues);
              if (Object.keys(fieldErrors).length > 0) {
                setFieldErrors(validateClothingItemForm(nextValues));
              }
            }}
            showAutofillButton={false}
            tagSuggestions={closetSuggestions.tagSuggestions}
            values={formValues}
          />
        </div>
      </ItemMetadataPanel>
      <AlertDialog
        open={isManualCreateWhileCleaningDialogOpen}
        onOpenChange={setIsManualCreateWhileCleaningDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Your image is still being cleaned</AlertDialogTitle>
            <AlertDialogDescription>
              The AI-cleaned version is still processing. You can create the item now with the
              current image, or create it now and let the cleaned version auto-save onto the item
              once it is ready.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-between">
            <AlertDialogCancel disabled={isCreating}>Cancel</AlertDialogCancel>
            <div className="flex flex-col gap-2 sm:flex-row">
              <AlertDialogAction
                disabled={isCreating}
                className="border border-border bg-background text-foreground hover:bg-accent"
                onClick={(event) => {
                  event.preventDefault();
                  setIsManualCreateWhileCleaningDialogOpen(false);
                  void createManualItem("current");
                }}
              >
                Create with current image
              </AlertDialogAction>
              <AlertDialogAction
                disabled={isCreating}
                onClick={(event) => {
                  event.preventDefault();
                  setIsManualCreateWhileCleaningDialogOpen(false);
                  void createManualItem("attach-when-ready");
                }}
              >
                Auto-save cleaned image
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ItemEditorWorkspace>
  );
}

function useFileObjectUrls(files: File[]) {
  const [objectUrls, setObjectUrls] = useState<string[]>([]);

  useEffect(() => {
    const nextUrls = files.map((file) => URL.createObjectURL(file));
    setObjectUrls(nextUrls);

    return () => nextUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  return objectUrls;
}

async function cropDetectionImageFile(
  sourceFile: File,
  cropBox: { x: number; y: number; width: number; height: number },
  filename: string,
) {
  const image = await loadImageFromFile(sourceFile);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(cropBox.width * image.naturalWidth));
  canvas.height = Math.max(1, Math.floor(cropBox.height * image.naturalHeight));
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to prepare this detected item for editing.");
  }

  context.drawImage(
    image,
    cropBox.x * image.naturalWidth,
    cropBox.y * image.naturalHeight,
    cropBox.width * image.naturalWidth,
    cropBox.height * image.naturalHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return canvasToPngFile(canvas, filename);
}

async function loadImageFromFile(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Unable to load this detected item for editing."));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function canvasToPngFile(canvas: HTMLCanvasElement, filename: string) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (!nextBlob) {
        reject(new Error("Unable to prepare the edited detected item."));
        return;
      }

      resolve(nextBlob);
    }, "image/png");
  });

  return new File([blob], sanitizeImageFilename(filename), { type: blob.type || "image/png" });
}

function sanitizeImageFilename(filename: string) {
  const normalized = filename
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "detected-item.png";
}
