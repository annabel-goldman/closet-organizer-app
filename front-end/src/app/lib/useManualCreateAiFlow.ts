import { MutableRefObject, useEffect, useRef, useState } from "react";
import {
  ClothingItemFormValues,
  createCleanPreviewFile,
  createTransparentPreviewFile,
  mergeMetadataSuggestion,
  previewMetadataSuggestions,
} from "./closet";
import { useAiActionState } from "./useAiActionState";

export type PendingCleanMode = "preview" | "ignore" | "attach";

export interface StagedCleanPreviewResult {
  cleanImageCutoutFallback: boolean;
  cleanImageVariant: "cleaned" | "transparent";
  file: File;
  workingFile: File | null;
}

interface ManualAiPhotoState {
  selectedFile: File | null;
  updateSelectedFile: (file: File | null) => void;
}

interface UseManualCreateAiFlowOptions<UndoSnapshot> {
  captureUndoSnapshot: () => UndoSnapshot;
  formValues: ClothingItemFormValues;
  latestUploadedPhotoRef: MutableRefObject<File | null>;
  onError: (error: unknown, fallbackMessage: string) => void;
  photoState: ManualAiPhotoState;
  pushUndoSnapshot: (snapshot: UndoSnapshot) => void;
  setErrorMessage: (message: string) => void;
  setFormValues: (updater: (current: ClothingItemFormValues) => ClothingItemFormValues) => void;
}

export function useManualCreateAiFlow<UndoSnapshot>({
  captureUndoSnapshot,
  formValues,
  latestUploadedPhotoRef,
  onError,
  photoState,
  pushUndoSnapshot,
  setErrorMessage,
  setFormValues,
}: UseManualCreateAiFlowOptions<UndoSnapshot>) {
  const cleanAction = useAiActionState();
  const transparentAction = useAiActionState();
  const metadataAction = useAiActionState();
  const isMountedRef = useRef(true);
  const pendingManualCleanPromiseRef = useRef<Promise<StagedCleanPreviewResult> | null>(null);
  const pendingManualCleanModeRef = useRef<PendingCleanMode>("preview");
  const pendingManualCleanRequestIdRef = useRef(0);
  const [stagedManualCleanImageVariant, setStagedManualCleanImageVariant] = useState<
    "cleaned" | "transparent" | null
  >(null);
  const [stagedManualCutoutFallback, setStagedManualCutoutFallback] = useState(false);
  const [stagedManualWorkingCleanPhoto, setStagedManualWorkingCleanPhoto] = useState<File | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  function cancelPendingManualCleanPreview() {
    pendingManualCleanRequestIdRef.current += 1;
    pendingManualCleanPromiseRef.current = null;
    pendingManualCleanModeRef.current = "ignore";
    cleanAction.invalidate();
  }

  function resetManualCleanState() {
    setStagedManualCleanImageVariant(null);
    setStagedManualCutoutFallback(false);
    setStagedManualWorkingCleanPhoto(null);
  }

  function restoreManualCleanState(snapshot: {
    cleanImageVariant: "cleaned" | "transparent" | null;
    cutoutFallback: boolean;
    workingPhoto: File | null;
  }) {
    setStagedManualCleanImageVariant(snapshot.cleanImageVariant);
    setStagedManualCutoutFallback(snapshot.cutoutFallback);
    setStagedManualWorkingCleanPhoto(snapshot.workingPhoto);
  }

  async function handleCleanUploadedPhoto() {
    const cleanSourcePhoto =
      latestUploadedPhotoRef.current
      ?? stagedManualWorkingCleanPhoto
      ?? photoState.selectedFile;

    if (!cleanSourcePhoto) {
      setErrorMessage("Upload a photo before using the AI cleaner.");
      return;
    }

    cleanAction.start();
    setErrorMessage("");
    const undoSnapshot = captureUndoSnapshot();
    const requestId = pendingManualCleanRequestIdRef.current + 1;
    pendingManualCleanRequestIdRef.current = requestId;
    pendingManualCleanModeRef.current = "preview";

    try {
      const cleanedFilePromise = createCleanPreviewFile(cleanSourcePhoto, {
        metadata: formValues,
        originalSourcePhoto: latestUploadedPhotoRef.current,
      });
      pendingManualCleanPromiseRef.current = cleanedFilePromise;
      const cleanedPreview = await cleanedFilePromise;

      if (
        !isMountedRef.current
        || pendingManualCleanRequestIdRef.current !== requestId
        || pendingManualCleanModeRef.current !== "preview"
      ) {
        cleanAction.invalidate();
        return;
      }

      pendingManualCleanPromiseRef.current = null;
      pushUndoSnapshot(undoSnapshot);
      photoState.updateSelectedFile(cleanedPreview.file);
      setStagedManualCleanImageVariant(cleanedPreview.cleanImageVariant);
      setStagedManualCutoutFallback(cleanedPreview.cleanImageCutoutFallback);
      setStagedManualWorkingCleanPhoto(cleanedPreview.workingFile);
      cleanAction.succeed();
    } catch (error) {
      if (
        isMountedRef.current
        && pendingManualCleanRequestIdRef.current === requestId
      ) {
        pendingManualCleanPromiseRef.current = null;
        cleanAction.fail(error instanceof Error ? error.message : "Unable to create an AI-cleaned item image.");
        onError(error, "Unable to create an AI-cleaned item image.");
      }
    }
  }

  async function handleMakeUploadedTransparent() {
    const workingSourcePhoto = stagedManualWorkingCleanPhoto ?? photoState.selectedFile;
    if (!workingSourcePhoto || stagedManualCleanImageVariant !== "cleaned") {
      setErrorMessage("Run AI clean image before making a transparent PNG.");
      return;
    }

    transparentAction.start();
    setErrorMessage("");
    const undoSnapshot = captureUndoSnapshot();

    try {
      const transparentPreview = await createTransparentPreviewFile(workingSourcePhoto);
      pushUndoSnapshot(undoSnapshot);
      photoState.updateSelectedFile(transparentPreview.file);
      setStagedManualCleanImageVariant(transparentPreview.cleanImageVariant);
      setStagedManualCutoutFallback(transparentPreview.cleanImageCutoutFallback);
      transparentAction.succeed();
    } catch (error) {
      transparentAction.fail(
        error instanceof Error ? error.message : "Unable to make a transparent PNG for this item image.",
      );
      onError(error, "Unable to make a transparent PNG for this item image.");
    }
  }

  async function handleAutofillManualMetadata() {
    const metadataSourcePhoto = latestUploadedPhotoRef.current ?? photoState.selectedFile;
    if (!metadataSourcePhoto) {
      setErrorMessage("Upload a photo before using AI autofill.");
      return;
    }

    metadataAction.start();
    setErrorMessage("");
    const undoSnapshot = captureUndoSnapshot();

    try {
      const suggestion = await previewMetadataSuggestions(metadataSourcePhoto, undefined, {
        metadata: formValues,
      });
      pushUndoSnapshot(undoSnapshot);
      setFormValues((current) => mergeMetadataSuggestion(current, suggestion));
      metadataAction.succeed();
    } catch (error) {
      metadataAction.fail(error instanceof Error ? error.message : "Unable to autofill this item's metadata.");
      onError(error, "Unable to autofill this item's metadata.");
    }
  }

  return {
    cleanStatus: cleanAction.status,
    cancelPendingManualCleanPreview,
    handleAutofillManualMetadata,
    handleCleanUploadedPhoto,
    handleMakeUploadedTransparent,
    isAutofillingMetadata: metadataAction.isRunning,
    isCleaningUploadedPhoto: cleanAction.isRunning,
    isMakingUploadedTransparent: transparentAction.isRunning,
    pendingManualCleanModeRef,
    pendingManualCleanPromiseRef,
    pendingManualCleanRequestIdRef,
    resetManualCleanState,
    restoreManualCleanState,
    stagedManualCleanImageVariant,
    stagedManualCutoutFallback,
    stagedManualWorkingCleanPhoto,
  };
}
