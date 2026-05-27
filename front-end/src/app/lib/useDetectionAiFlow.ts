import { MutableRefObject, useEffect, useRef, useState } from "react";
import {
  ClothingItemFormValues,
  createCleanPreviewFile,
  createCroppedImageFile,
  createTransparentPreviewFile,
  fetchImageFileFromUrl,
  OutfitDetection,
} from "./closet";
import { PendingCleanMode, StagedCleanPreviewResult } from "./useManualCreateAiFlow";

export interface StagedDetectionCleanPreview extends StagedCleanPreviewResult {
  previewUrl: string;
}

interface UseDetectionAiFlowOptions {
  getDetectionDraft: (detection: OutfitDetection) => ClothingItemFormValues;
  onError: (error: unknown, fallbackMessage: string) => void;
  sourceImageUrl: string | null;
}

export function useDetectionAiFlow({
  getDetectionDraft,
  onError,
  sourceImageUrl,
}: UseDetectionAiFlowOptions) {
  const isMountedRef = useRef(true);
  const [cleaningDetectionIds, setCleaningDetectionIds] = useState<number[]>([]);
  const [makingDetectionTransparentIds, setMakingDetectionTransparentIds] = useState<number[]>([]);
  const [detectionCleanErrors, setDetectionCleanErrors] = useState<Record<number, string>>({});
  const [stagedDetectionCleanPreviews, setStagedDetectionCleanPreviews] = useState<
    Record<number, StagedDetectionCleanPreview>
  >({});
  const stagedDetectionCleanPreviewsRef = useRef<Record<number, StagedDetectionCleanPreview>>({});
  const pendingDetectionCleanPromisesRef = useRef<Record<number, Promise<StagedCleanPreviewResult>>>({});
  const pendingDetectionCleanModesRef = useRef<Record<number, PendingCleanMode>>({});

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      Object.values(stagedDetectionCleanPreviewsRef.current).forEach((preview) => {
        URL.revokeObjectURL(preview.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    stagedDetectionCleanPreviewsRef.current = stagedDetectionCleanPreviews;
  }, [stagedDetectionCleanPreviews]);

  function clearAllStagedDetectionCleanPreviews() {
    setStagedDetectionCleanPreviews((current) => {
      Object.values(current).forEach((preview) => {
        URL.revokeObjectURL(preview.previewUrl);
      });

      return {};
    });
  }

  function resetDetectionAiState() {
    pendingDetectionCleanPromisesRef.current = {};
    pendingDetectionCleanModesRef.current = {};
    setCleaningDetectionIds([]);
    setMakingDetectionTransparentIds([]);
    setDetectionCleanErrors({});
    clearAllStagedDetectionCleanPreviews();
  }

  function setStagedDetectionCleanPreviewWithDetails(
    detectionId: number,
    file: File | null,
    details: Pick<StagedDetectionCleanPreview, "cleanImageCutoutFallback" | "cleanImageVariant" | "workingFile"> | null,
  ) {
    setStagedDetectionCleanPreviews((current) => {
      const previousPreview = current[detectionId];
      if (previousPreview) {
        URL.revokeObjectURL(previousPreview.previewUrl);
      }

      if (!file) {
        const next = { ...current };
        delete next[detectionId];
        return next;
      }

      return {
        ...current,
        [detectionId]: {
          cleanImageCutoutFallback: details?.cleanImageCutoutFallback ?? false,
          cleanImageVariant: details?.cleanImageVariant ?? "cleaned",
          file,
          previewUrl: URL.createObjectURL(file),
          workingFile: details?.workingFile ?? null,
        },
      };
    });
  }

  function cleanedDetectionImageUrl(detection: OutfitDetection) {
    return stagedDetectionCleanPreviews[detection.id]?.previewUrl ?? detection.cleaned_image_url ?? null;
  }

  function detectionCleanImageVariant(detection: OutfitDetection) {
    return stagedDetectionCleanPreviews[detection.id]?.cleanImageVariant ?? detection.clean_image_variant ?? null;
  }

  async function handleCleanDetectionImage(detection: OutfitDetection) {
    const detectionId = detection.id;
    setCleaningDetectionIds((current) => [...current, detectionId]);
    setDetectionCleanErrors((current) => {
      const next = { ...current };
      delete next[detectionId];
      return next;
    });

    try {
      const previewBox = detection.bounding_box ?? detection.final_box ?? detection.refined_box ?? detection.coarse_box;
      let sourcePhoto: File | null = null;
      const stagedPreview = stagedDetectionCleanPreviewsRef.current[detectionId];

      if (stagedPreview) {
        sourcePhoto = stagedPreview.workingFile ?? stagedPreview.file;
      } else if (detection.cleaned_working_image_url) {
        sourcePhoto = await fetchImageFileFromUrl(
          detection.cleaned_working_image_url,
          `${detection.suggested_name || detection.category}-cleaned-working.png`,
        );
      } else if (detection.cleaned_image_url) {
        sourcePhoto = await fetchImageFileFromUrl(
          detection.cleaned_image_url,
          `${detection.suggested_name || detection.category}-cleaned.png`,
        );
      } else if (sourceImageUrl && previewBox) {
        sourcePhoto = await createCroppedImageFile(
          sourceImageUrl,
          previewBox,
          `${detection.suggested_name || detection.category}-crop.png`,
        );
      }

      if (!sourcePhoto) {
        throw new Error("Unable to prepare this detected item for AI cleaning.");
      }

      pendingDetectionCleanModesRef.current[detectionId] = "preview";
      const cleanedFilePromise = createCleanPreviewFile(sourcePhoto, {
        metadata: getDetectionDraft(detection),
      });
      pendingDetectionCleanPromisesRef.current[detectionId] = cleanedFilePromise;
      const cleanedPreview = await cleanedFilePromise;

      if (
        !isMountedRef.current
        || pendingDetectionCleanModesRef.current[detectionId] !== "preview"
      ) {
        delete pendingDetectionCleanPromisesRef.current[detectionId];
        delete pendingDetectionCleanModesRef.current[detectionId];
        return;
      }

      delete pendingDetectionCleanPromisesRef.current[detectionId];
      delete pendingDetectionCleanModesRef.current[detectionId];
      setStagedDetectionCleanPreviewWithDetails(detectionId, cleanedPreview.file, {
        cleanImageCutoutFallback: cleanedPreview.cleanImageCutoutFallback,
        cleanImageVariant: cleanedPreview.cleanImageVariant,
        workingFile: cleanedPreview.workingFile,
      });
    } catch (error) {
      delete pendingDetectionCleanPromisesRef.current[detectionId];
      delete pendingDetectionCleanModesRef.current[detectionId];
      if (isMountedRef.current) {
        setDetectionCleanErrors((current) => ({
          ...current,
          [detectionId]:
            error instanceof Error ? error.message : "Unable to create an AI-cleaned detection image.",
        }));
        onError(error, "Unable to create an AI-cleaned detection image.");
      }
    } finally {
      if (isMountedRef.current) {
        setCleaningDetectionIds((current) => current.filter((id) => id !== detectionId));
      }
    }
  }

  async function handleMakeDetectionTransparent(detection: OutfitDetection) {
    const detectionId = detection.id;
    setMakingDetectionTransparentIds((current) => [...current, detectionId]);
    setDetectionCleanErrors((current) => {
      const next = { ...current };
      delete next[detectionId];
      return next;
    });

    try {
      let sourcePhoto: File | null = null;

      if (stagedDetectionCleanPreviewsRef.current[detectionId]?.cleanImageVariant === "cleaned") {
        sourcePhoto =
          stagedDetectionCleanPreviewsRef.current[detectionId].workingFile
          ?? stagedDetectionCleanPreviewsRef.current[detectionId].file;
      } else if (detection.cleaned_working_image_url && detection.clean_image_variant === "cleaned") {
        sourcePhoto = await fetchImageFileFromUrl(
          detection.cleaned_working_image_url,
          `${detection.suggested_name || detection.category}-cleaned-working.png`,
        );
      } else if (detection.cleaned_image_url && detection.clean_image_variant === "cleaned") {
        sourcePhoto = await fetchImageFileFromUrl(
          detection.cleaned_image_url,
          `${detection.suggested_name || detection.category}-cleaned.png`,
        );
      }

      if (!sourcePhoto) {
        throw new Error("Run AI clean image before making a transparent PNG.");
      }

      const transparentPreview = await createTransparentPreviewFile(sourcePhoto);
      setStagedDetectionCleanPreviewWithDetails(detectionId, transparentPreview.file, {
        cleanImageCutoutFallback: transparentPreview.cleanImageCutoutFallback,
        cleanImageVariant: transparentPreview.cleanImageVariant,
        workingFile: stagedDetectionCleanPreviewsRef.current[detectionId]?.workingFile ?? sourcePhoto,
      });
    } catch (error) {
      setDetectionCleanErrors((current) => ({
        ...current,
        [detectionId]:
          error instanceof Error ? error.message : "Unable to make a transparent PNG for this detection.",
      }));
      onError(error, "Unable to make a transparent PNG for this detection.");
    } finally {
      if (isMountedRef.current) {
        setMakingDetectionTransparentIds((current) => current.filter((id) => id !== detectionId));
      }
    }
  }

  return {
    cleanedDetectionImageUrl,
    cleaningDetectionIds,
    clearAllStagedDetectionCleanPreviews,
    detectionCleanErrors,
    detectionCleanImageVariant,
    handleCleanDetectionImage,
    handleMakeDetectionTransparent,
    makingDetectionTransparentIds,
    pendingDetectionCleanModesRef,
    pendingDetectionCleanPromisesRef,
    resetDetectionAiState,
    setStagedDetectionCleanPreviewWithDetails,
    stagedDetectionCleanPreviews,
  };
}
