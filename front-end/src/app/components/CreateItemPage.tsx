import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, RotateCcw, RotateCw, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  buildItemPreviewMetadata,
  ClothingItem,
  ClothingItemFormValues,
  createCleanPreviewFile,
  createClothingItem,
  createCroppedImageFile,
  createOutfitUpload,
  createTransparentPreviewFile,
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
import { AiMetadataAutofillButton } from "./AiMetadataAutofillButton";
import { CreateItemImageMode } from "./create-item/CreateItemImageMode";
import { ItemEditorWorkspace } from "./ItemEditorWorkspace";
import { ItemMetadataFields } from "./ItemMetadataFields";
import { ItemMetadataPanel } from "./ItemMetadataPanel";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveConfirmationDialog } from "./primitives/PrimitiveConfirmationDialog";
import { PrimitiveText } from "./primitives/PrimitiveText";
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
import { useItemPhotoState } from "../lib/useItemPhotoState";
import type { ItemPhotoStateSnapshot } from "../lib/useItemPhotoState";
import { useUndoRedoShortcuts } from "../lib/useUndoRedoShortcuts";
import { useManualCreateAiFlow } from "../lib/useManualCreateAiFlow";
import { useDetectionAiFlow } from "../lib/useDetectionAiFlow";
import type { ExpandedImageEditorApplyContext } from "./ExpandedImageEditor";

interface CreateItemPageProps {
  userId: number | null;
  initialMode?: CreateItemMode;
  initialUser?: User | null;
  onBack: () => void;
  onItemsCreated: (items: ClothingItem[]) => void;
}

const MANUAL_METADATA_UNDO_DELAY_MS = 600;

interface ManualCreateUndoSnapshot {
  formValues: ClothingItemFormValues;
  latestUploadedPhoto: File | null;
  photoState: ItemPhotoStateSnapshot;
  stagedManualImageKind: "cleaned" | "transparent" | null;
}

type DetectionDraftHistory = Record<number, ClothingItemFormValues[]>;

export function CreateItemPage({
  userId,
  initialMode = "manual",
  initialUser,
  onBack,
  onItemsCreated,
}: CreateItemPageProps) {
  const detectionPollControllerRef = useRef<AbortController | null>(null);
  const detectionMetadataRunRef = useRef(0);
  const latestUploadedPhotoRef = useRef<File | null>(null);
  const formValuesRef = useRef<ClothingItemFormValues>(emptyClothingItemFormValues);
  const manualMetadataUndoSessionRef = useRef<ManualCreateUndoSnapshot | null>(null);
  const manualMetadataUndoTimeoutRef = useRef<number | null>(null);
  const [formValues, setFormValues] = useState(emptyClothingItemFormValues);
  const [fieldErrors, setFieldErrors] = useState<ClothingItemFormErrors>({});
  const [isCreating, setIsCreating] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [autofillingDetectionId, setAutofillingDetectionId] = useState<number | null>(null);
  const [isPreparingDetectedMetadata, setIsPreparingDetectedMetadata] = useState(false);
  const [isReplaceImageWarningOpen, setIsReplaceImageWarningOpen] = useState(false);
  const [isManualCreateWhileCleaningDialogOpen, setIsManualCreateWhileCleaningDialogOpen] = useState(false);
  const [isDetectedCreateWhileCleaningDialogOpen, setIsDetectedCreateWhileCleaningDialogOpen] = useState(false);
  const [manualUndoHistory, setManualUndoHistory] = useState<ManualCreateUndoSnapshot[]>([]);
  const [manualRedoHistory, setManualRedoHistory] = useState<ManualCreateUndoSnapshot[]>([]);
  const [detectionUndoHistory, setDetectionUndoHistory] = useState<DetectionDraftHistory>({});
  const [detectionRedoHistory, setDetectionRedoHistory] = useState<DetectionDraftHistory>({});
  const [outfitUpload, setOutfitUpload] = useState<OutfitUpload | null>(null);
  const [pendingReplacementFile, setPendingReplacementFile] = useState<File | null>(null);
  const [selectedDetectionIds, setSelectedDetectionIds] = useState<number[]>([]);
  const [editedDetections, setEditedDetections] = useState<Record<number, ClothingItemFormValues>>(
    {},
  );
  const photoState = useItemPhotoState();
  const isMountedRef = useRef(true);

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
  const sourceImageUrl = photoState.imageUrl ?? outfitUpload?.source_photo_url ?? null;
  const detections = outfitUpload?.detections ?? [];
  const selectedDetections = detections.filter((detection) => selectedDetectionIds.includes(detection.id));
  const selectedCount = selectedDetections.length;

  const manualAi = useManualCreateAiFlow({
    captureUndoSnapshot: captureManualUndoSnapshot,
    formValues,
    latestUploadedPhotoRef,
    onError: showRequestError,
    photoState,
    pushUndoSnapshot: pushManualUndoSnapshot,
    setErrorMessage,
    setFormValues: (updater) => setFormValues(updater),
  });
  const detectionAi = useDetectionAiFlow({
    getDetectionDraft,
    onError: showRequestError,
    sourceImageUrl,
  });
  const {
    cancelPendingManualCleanPreview,
    handleAutofillManualMetadata,
    isAutofillingMetadata,
    isCleaningUploadedPhoto,
    isMakingUploadedTransparent,
    pendingManualCleanModeRef,
    pendingManualCleanPromiseRef,
    resetManualCleanState,
    restoreManualCleanState,
    stagedManualImageKind,
  } = manualAi;
  const {
    cleanedDetectionImageUrl,
    cleaningDetectionIds,
    detectionImageKind,
    detectionCleanErrors,
    makingDetectionTransparentIds,
    pendingDetectionCleanModesRef,
    pendingDetectionCleanPromisesRef,
    stagedDetectionCleanPreviews,
  } = detectionAi;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      detectionPollControllerRef.current?.abort();
      clearManualMetadataUndoTimer();
    };
  }, []);

  useEffect(() => {
    formValuesRef.current = formValues;
  }, [formValues]);

  function showRequestError(error: unknown, fallbackMessage: string) {
    const message = error instanceof Error ? error.message : fallbackMessage;
    setErrorMessage("");
    toast.error(message);
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
      toast.success(`AI-cleaned image saved to ${createdItem.name}.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Created ${createdItem.name}, but the AI-cleaned image could not be attached: ${error.message}`
          : `Created ${createdItem.name}, but the AI-cleaned image could not be attached.`,
      );
    }
  }

  function resetDetectionState() {
    detectionMetadataRunRef.current += 1;
    detectionAi.pendingDetectionCleanPromisesRef.current = {};
    detectionAi.pendingDetectionCleanModesRef.current = {};
    setOutfitUpload(null);
    setSelectedDetectionIds([]);
    detectionAi.resetDetectionAiState();
    setEditedDetections({});
    setDetectionUndoHistory({});
    setDetectionRedoHistory({});
    setAutofillingDetectionId(null);
    setIsPreparingDetectedMetadata(false);
  }

  function clearManualMetadataUndoTimer() {
    if (manualMetadataUndoTimeoutRef.current) {
      window.clearTimeout(manualMetadataUndoTimeoutRef.current);
      manualMetadataUndoTimeoutRef.current = null;
    }
  }

  function stageManualMetadataUndoSnapshot() {
    if (!manualMetadataUndoSessionRef.current) {
      manualMetadataUndoSessionRef.current = captureManualUndoSnapshot();
    }

    setManualRedoHistory([]);
    clearManualMetadataUndoTimer();
    manualMetadataUndoTimeoutRef.current = window.setTimeout(() => {
      finalizeManualMetadataUndoSession(formValuesRef.current);
    }, MANUAL_METADATA_UNDO_DELAY_MS);
  }

  function finalizeManualMetadataUndoSession(nextValues: ClothingItemFormValues = formValuesRef.current) {
    const sessionSnapshot = manualMetadataUndoSessionRef.current;
    clearManualMetadataUndoTimer();
    manualMetadataUndoSessionRef.current = null;

    if (!sessionSnapshot) {
      return;
    }

    if (JSON.stringify(sessionSnapshot.formValues) === JSON.stringify(nextValues)) {
      return;
    }

    setManualUndoHistory((current) => [...current, sessionSnapshot]);
  }

  function consumePendingManualMetadataUndoSnapshot() {
    const sessionSnapshot = manualMetadataUndoSessionRef.current;
    clearManualMetadataUndoTimer();
    manualMetadataUndoSessionRef.current = null;

    if (!sessionSnapshot) {
      return null;
    }

    if (JSON.stringify(sessionSnapshot.formValues) === JSON.stringify(formValuesRef.current)) {
      return null;
    }

    return sessionSnapshot;
  }

  function applyImageFileSelection(
    file: File,
    imageKind: ExpandedImageEditorApplyContext["imageKind"] = "base",
  ) {
    pushManualUndoSnapshot();
    detectionPollControllerRef.current?.abort();
    manualAi.cancelPendingManualCleanPreview();
    if (imageKind === "base") {
      latestUploadedPhotoRef.current = file;
    } else if (!latestUploadedPhotoRef.current) {
      latestUploadedPhotoRef.current = file;
    }
    photoState.updateSelectedFile(file);
    manualAi.restoreManualCleanState({
      imageKind: imageKind === "base" ? null : imageKind,
    });
    resetDetectionState();
    setErrorMessage("");
  }

  async function getManualPreviewEditorFile() {
    return photoState.selectedFile;
  }

  async function getSourceImageEditorFile() {
    if (latestUploadedPhotoRef.current) {
      return latestUploadedPhotoRef.current;
    }

    if (!sourceImageUrl) {
      return null;
    }

    return fetchImageFileFromUrl(sourceImageUrl, photoState.selectedFile?.name ?? "source-image.png");
  }

  async function getDetectionImageEditorFile(detection: OutfitDetection) {
    const stagedPreview = stagedDetectionCleanPreviews[detection.id];
    if (stagedPreview) {
      return stagedPreview.file;
    }

    if (detection.cleaned_image_url) {
      return fetchImageFileFromUrl(
        detection.cleaned_image_url,
        `${detection.suggested_name || detection.category}-cleaned.png`,
      );
    }

    const previewBox = preferredDetectionBox(detection);
    if (!sourceImageUrl || !previewBox) {
      return null;
    }

    return createCroppedImageFile(
      sourceImageUrl,
      previewBox,
      `${detection.suggested_name || detection.category}-crop.png`,
    );
  }

  async function createManualEditorCleanImage(file: File) {
    return createCleanPreviewFile(file, {
      metadata: formValuesRef.current,
      originalSourcePhoto: latestUploadedPhotoRef.current,
    });
  }

  async function createManualEditorTransparentPng(file: File) {
    return createTransparentPreviewFile(file);
  }

  async function createDetectionEditorCleanImage(detection: OutfitDetection, file: File) {
    return createCleanPreviewFile(file, {
      metadata: getDetectionDraft(detection),
    });
  }

  async function createDetectionEditorTransparentPng(file: File) {
    return createTransparentPreviewFile(file);
  }

  async function applyDetectionImageFileEdits(
    detection: OutfitDetection,
    file: File,
    context: ExpandedImageEditorApplyContext,
  ) {
    detectionAi.setStagedDetectionCleanPreview(detection.id, file, context.imageKind);
  }

  function closeReplaceImageWarning(open: boolean) {
    setIsReplaceImageWarningOpen(open);

    if (!open) {
      setPendingReplacementFile(null);
      if (photoState.inputRef.current) {
        photoState.inputRef.current.value = "";
      }
    }
  }

  function confirmReplaceImage() {
    if (pendingReplacementFile) {
      applyImageFileSelection(pendingReplacementFile);
    }

    setPendingReplacementFile(null);
    setIsReplaceImageWarningOpen(false);
  }

  async function waitForOutfitUpload(uploadId: number, signal: AbortSignal) {
    const startedAt = Date.now();

    while (!signal.aborted) {
      const nextUpload = await fetchOutfitUpload(uploadId, signal);
      setOutfitUpload(nextUpload);

      if (nextUpload.status === "succeeded" || nextUpload.status === "failed") {
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

  async function detectItems(file: File) {
    if (!userId) {
      setErrorMessage("A user is required before you can upload from an image.");
      return;
    }

    setIsDetecting(true);
    setErrorMessage("");
    resetDetectionState();
    detectionPollControllerRef.current?.abort();

    try {
      const nextUpload = await createOutfitUpload(userId, { photo: file });
      setOutfitUpload(nextUpload);

      if (nextUpload.status === "pending" || nextUpload.status === "processing") {
        const controller = new AbortController();
        detectionPollControllerRef.current = controller;
        const completedUpload = await waitForOutfitUpload(nextUpload.id, controller.signal);

        if (completedUpload.status === "failed" && completedUpload.error_message) {
          toast.error(completedUpload.error_message);
        } else if (completedUpload.status === "succeeded") {
          await autofillDetectedMetadata(completedUpload.detections);
        }
      } else if (nextUpload.status === "failed" && nextUpload.error_message) {
        toast.error(nextUpload.error_message);
      } else if (nextUpload.status === "succeeded") {
        await autofillDetectedMetadata(nextUpload.detections);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      showRequestError(error, "Unable to analyze this item photo.");
    } finally {
      detectionPollControllerRef.current = null;
      setIsDetecting(false);
    }
  }

  function handleImageFileChange(file: File | null) {
    if (!file) {
      return;
    }

    const shouldWarnBeforeReplacingImage = isImageMode && Boolean(outfitUpload);

    if (shouldWarnBeforeReplacingImage) {
      setPendingReplacementFile(file);
      setIsReplaceImageWarningOpen(true);
      return;
    }

    applyImageFileSelection(file);
  }

  function clearImageSelection() {
    if (photoState.selectedFile || latestUploadedPhotoRef.current || stagedManualImageKind) {
      pushManualUndoSnapshot();
    }
    detectionPollControllerRef.current?.abort();
    cancelPendingManualCleanPreview();
    latestUploadedPhotoRef.current = null;
    photoState.clearSelectedFile();
    resetManualCleanState();
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

  function setDetectionDraftValues(detection: OutfitDetection, nextValues: ClothingItemFormValues) {
    const baseValues = toClothingItemFormValuesFromDetection(detection);

    setEditedDetections((current) => {
      if (JSON.stringify(nextValues) === JSON.stringify(baseValues)) {
        const next = { ...current };
        delete next[detection.id];
        return next;
      }

      return {
        ...current,
        [detection.id]: nextValues,
      };
    });
  }

  function updateDetectionDraft(detection: OutfitDetection, nextValues: ClothingItemFormValues) {
    const previousValues = getDetectionDraft(detection);
    if (JSON.stringify(previousValues) === JSON.stringify(nextValues)) {
      return;
    }

    setDetectionUndoHistory((current) => ({
      ...current,
      [detection.id]: [...(current[detection.id] ?? []), previousValues],
    }));
    setDetectionRedoHistory((current) => ({
      ...current,
      [detection.id]: [],
    }));
    setDetectionDraftValues(detection, nextValues);
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

  async function handleAutofillDetectionMetadata(detection: OutfitDetection) {
    setAutofillingDetectionId(detection.id);
    setErrorMessage("");

    try {
      const suggestion = await generateOutfitDetectionMetadataSuggestions(
        detection.id,
        getDetectionDraft(detection),
      );
      updateDetectionDraft(
        detection,
        mergeMetadataSuggestion(getDetectionDraft(detection), suggestion),
      );
      toast.success("AI autofilled detected item details.");
    } catch (error) {
      showRequestError(error, "Unable to autofill this detected item's metadata.");
    } finally {
      setAutofillingDetectionId(null);
    }
  }

  async function autofillDetectedMetadata(nextDetections: OutfitDetection[]) {
    const detectionIdsToAutofill = nextDetections
      .filter(
        (detection) =>
          Boolean(
            detection.cleaned_image_url
            || detection.bounding_box
            || detection.final_box
            || detection.refined_box
            || detection.coarse_box,
          ),
      )
      .map((detection) => detection.id);

    if (detectionIdsToAutofill.length === 0) {
      return;
    }

    const runId = ++detectionMetadataRunRef.current;
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

          setDetectionDraftValues(
            detection,
            mergeMetadataSuggestion(getDetectionDraft(detection), suggestion),
          );
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
        setIsPreparingDetectedMetadata(false);
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

  async function createManualItem(cleaningStrategy: "current" | "attach-when-ready" = "current") {
    if (!userId) {
      setErrorMessage("A user is required before you can create an item.");
      return;
    }

    const valuesSnapshot = { ...formValues };
    const cleaningPromise = pendingManualCleanPromiseRef.current;
    if (cleaningStrategy === "attach-when-ready" && cleaningPromise) {
      pendingManualCleanModeRef.current = "attach";
    } else if (cleaningPromise) {
      pendingManualCleanModeRef.current = "ignore";
    }

    setIsCreating(true);
    setErrorMessage("");

    try {
      const createdItem = await createClothingItem(userId, valuesSnapshot, {
        cleanedPhoto: stagedManualImageKind ? photoState.selectedFile : undefined,
        photo: stagedManualImageKind
          ? (latestUploadedPhotoRef.current ?? undefined)
          : photoState.selectedFile,
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
      showRequestError(error, "Unable to create this clothing item.");
      setIsCreating(false);
      pendingManualCleanModeRef.current = "preview";
    }
  }

  async function createSelectedDetectionItems(cleaningStrategy: "current" | "attach-when-ready" = "current") {
    if (!userId) {
      setErrorMessage("A user is required before you can save items to the closet.");
      return;
    }

    setIsCreating(true);
    setErrorMessage("");

    try {
      const createdItems: ClothingItem[] = [];

      for (const detection of selectedDetections) {
        const draftSnapshot = { ...getDetectionDraft(detection) };
        const pendingCleanPromise = pendingDetectionCleanPromisesRef.current[detection.id] ?? null;
        if (pendingCleanPromise) {
          pendingDetectionCleanModesRef.current[detection.id] =
            cleaningStrategy === "attach-when-ready" ? "attach" : "ignore";
        }

        const createdItem = await createClothingItem(userId, draftSnapshot, {
          photo: stagedDetectionCleanPreviews[detection.id]?.imageKind === "base"
            ? stagedDetectionCleanPreviews[detection.id]?.file
            : undefined,
          cleanedPhoto: stagedDetectionCleanPreviews[detection.id]?.imageKind === "base"
            ? undefined
            : stagedDetectionCleanPreviews[detection.id]?.file,
          sourceOutfitDetectionId: detection.id,
        });
        createdItems.push(createdItem);

        if (pendingCleanPromise && cleaningStrategy === "attach-when-ready") {
          void autoAttachCleanedPhotoToCreatedItem({
            cleanedFilePromise: pendingCleanPromise,
            createdItem,
            values: draftSnapshot,
          });
        }
      }

      onItemsCreated(createdItems);
    } catch (error) {
      showRequestError(error, "Unable to save the selected items to the closet.");
      setIsCreating(false);
    }
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

  function captureManualUndoSnapshot(): ManualCreateUndoSnapshot {
    return {
      formValues: { ...formValues },
      latestUploadedPhoto: latestUploadedPhotoRef.current,
      photoState: photoState.getSnapshot(),
      stagedManualImageKind,
    };
  }

  function pushManualUndoSnapshot(snapshot: ManualCreateUndoSnapshot = captureManualUndoSnapshot()) {
    finalizeManualMetadataUndoSession();
    setManualUndoHistory((current) => [...current, snapshot]);
    setManualRedoHistory([]);
  }

  function handleManualUndo() {
    const pendingSnapshot = consumePendingManualMetadataUndoSnapshot();
    const snapshot = pendingSnapshot ?? manualUndoHistory[manualUndoHistory.length - 1];
    if (!snapshot) {
      return;
    }

    const currentSnapshot = captureManualUndoSnapshot();
    if (!pendingSnapshot) {
      setManualUndoHistory((current) => current.slice(0, -1));
    }
    setManualRedoHistory((current) => [...current, currentSnapshot]);
    setFormValues({ ...snapshot.formValues });
    setFieldErrors(validateClothingItemForm(snapshot.formValues));
    latestUploadedPhotoRef.current = snapshot.latestUploadedPhoto;
    photoState.restoreSnapshot(snapshot.photoState);
    restoreManualCleanState({
      imageKind: snapshot.stagedManualImageKind,
    });
    setErrorMessage("");
  }

  function handleManualRedo() {
    finalizeManualMetadataUndoSession();
    const snapshot = manualRedoHistory[manualRedoHistory.length - 1];
    if (!snapshot) {
      return;
    }

    const currentSnapshot = captureManualUndoSnapshot();
    setManualRedoHistory((current) => current.slice(0, -1));
    setManualUndoHistory((current) => [...current, currentSnapshot]);
    setFormValues({ ...snapshot.formValues });
    setFieldErrors(validateClothingItemForm(snapshot.formValues));
    latestUploadedPhotoRef.current = snapshot.latestUploadedPhoto;
    photoState.restoreSnapshot(snapshot.photoState);
    restoreManualCleanState({
      imageKind: snapshot.stagedManualImageKind,
    });
    setErrorMessage("");
  }

  const manualUndoDisabled =
    isCreating || isCleaningUploadedPhoto || isMakingUploadedTransparent || isAutofillingMetadata;
  const canManualUndo = Boolean(manualMetadataUndoSessionRef.current) || manualUndoHistory.length > 0;
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

    const hasPendingSelectedClean = selectedDetections.some(
      (detection) => Boolean(pendingDetectionCleanPromisesRef.current[detection.id]),
    );

    if (hasPendingSelectedClean) {
      setIsDetectedCreateWhileCleaningDialogOpen(true);
      return;
    }

    await createSelectedDetectionItems();
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
          detectionImageKind={detectionImageKind}
          detectionCleanErrors={detectionCleanErrors}
          detections={detections}
          errorMessage={errorMessage}
          getDetectionDraft={getDetectionDraft}
          getDetectionCleanedImageUrl={cleanedDetectionImageUrl}
          hasDetectionDraft={hasDetectionDraft}
          inputRef={photoState.inputRef}
          isPreparingDetectedMetadata={isPreparingDetectedMetadata}
          isCreating={isCreating}
          isDetecting={isDetecting}
          makingDetectionTransparentIds={makingDetectionTransparentIds}
          onApplyDetectionImageEdits={(detection, file, context) => {
            void applyDetectionImageFileEdits(detection, file, context);
          }}
          onApplySourceImageEdits={async (file) => {
            handleImageFileChange(file);
          }}
          onBack={onBack}
          onClearImageSelection={clearImageSelection}
          onCreateDetectionEditorCleanImage={(detection, file) => createDetectionEditorCleanImage(detection, file)}
          onCreateDetectionEditorTransparentPng={createDetectionEditorTransparentPng}
          onDetectItems={() => photoState.selectedFile && void detectItems(photoState.selectedFile)}
          onDraftChange={updateDetectionDraft}
          onRequestDetectionAutofill={(detection) => void handleAutofillDetectionMetadata(detection)}
          onRedoDetectionDraft={handleDetectionRedo}
          onFileChange={handleImageFileChange}
          onGetDetectionImageEditorFile={getDetectionImageEditorFile}
          onGetSourceImageEditorFile={getSourceImageEditorFile}
          onSaveSelectedItems={() => void handleSaveSelectedItems()}
          onToggleSelection={toggleDetectionSelection}
          onUndoDetectionDraft={handleDetectionUndo}
          outfitUpload={outfitUpload}
          selectedCount={selectedCount}
          selectedDetectionIds={selectedDetectionIds}
          selectedFileName={photoState.selectedFile?.name}
          sourceImageUrl={sourceImageUrl}
          tagSuggestions={closetSuggestions.tagSuggestions}
          user={user}
        />
        <PrimitiveConfirmationDialog
          description="Uploading a new image will discard all currently detected items. Proceed?"
          onConfirm={confirmReplaceImage}
          onOpenChange={closeReplaceImageWarning}
          open={isReplaceImageWarningOpen}
        />
        <AlertDialog
          open={isDetectedCreateWhileCleaningDialogOpen}
          onOpenChange={setIsDetectedCreateWhileCleaningDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>AI cleaning is still running</AlertDialogTitle>
              <AlertDialogDescription>
                One or more selected detected items are still being AI cleaned. You can save them
                now with their current images, or keep going and let the cleaned versions auto-save
                onto the created items as soon as they finish.
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
                    setIsDetectedCreateWhileCleaningDialogOpen(false);
                    void createSelectedDetectionItems("current");
                  }}
                >
                  Save current images
                </AlertDialogAction>
                <AlertDialogAction
                  disabled={isCreating}
                  onClick={(event) => {
                    event.preventDefault();
                    setIsDetectedCreateWhileCleaningDialogOpen(false);
                    void createSelectedDetectionItems("attach-when-ready");
                  }}
                >
                  Auto-save cleaned images
                </AlertDialogAction>
              </div>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  const previewName = formValues.name.trim() || "Untitled Item";
  const previewMetadata = buildItemPreviewMetadata(formValues.size, parseTagInput(formValues.tags));

  return (
    <>
      <ItemEditorWorkspace
        backLabel="Back"
        formLabel="Add Item"
        formTopAction={
          <div className="flex items-center gap-2">
            <PrimitiveButton
              type="button"
              onClick={() => handleManualUndo()}
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
              onClick={() => handleManualRedo()}
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
          getEditableFile: getManualPreviewEditorFile,
          imageActions: {
            initialKind: stagedManualImageKind ?? "base",
            onClean: createManualEditorCleanImage,
            onMakeTransparent: createManualEditorTransparentPng,
          },
          onApply: async (file, context) => {
            applyImageFileSelection(file, context.imageKind);
          },
        } : undefined}
        onSubmit={handleManualSubmit}
        previewAriaLabel={photoState.selectedFile ? "Preview image" : "Upload photo"}
        previewBackgroundDecoration={
          <Upload
            className="h-40 w-40 text-stone-700/18 sm:h-52 sm:w-52"
            strokeWidth={1.1}
          />
        }
        isPreviewProcessing={false}
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
          onChange={(event) => handleImageFileChange(event.target.files?.[0] ?? null)}
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
          <div className="grid gap-5 sm:grid-cols-3">
            <ItemMetadataFields
              brandSuggestions={closetSuggestions.brandSuggestions}
              errors={fieldErrors}
              isAutofilling={isAutofillingMetadata}
              onChange={(nextValues) => {
                stageManualMetadataUndoSnapshot();
                setFormValues(nextValues);
                if (Object.keys(fieldErrors).length > 0) {
                  setFieldErrors(validateClothingItemForm(nextValues));
                }
              }}
              onFieldCommit={(nextValues) => finalizeManualMetadataUndoSession(nextValues)}
              showAutofillButton={false}
              tagSuggestions={closetSuggestions.tagSuggestions}
              values={formValues}
            />
          </div>
        </ItemMetadataPanel>
      </ItemEditorWorkspace>

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
    </>
  );
}
