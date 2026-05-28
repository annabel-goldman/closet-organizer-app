import { useEffect, useRef, useState } from "react";
import {
  ClothingItemFormValues,
  createCleanPreviewFile,
  createCroppedImageFile,
  createTransparentPreviewFile,
  fetchImageFileFromUrl,
  OutfitDetection,
} from "./closet";
import { PendingCleanMode } from "./useManualCreateAiFlow";

export interface StagedDetectionCleanPreview {
  file: File;
  imageKind: "cleaned" | "transparent";
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
  const pendingDetectionCleanPromisesRef = useRef<Record<number, Promise<File>>>({});
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

  function setStagedDetectionCleanPreview(detectionId: number, file: File | null) {
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
          file,
          imageKind: "cleaned",
          previewUrl: URL.createObjectURL(file),
        },
      };
    });
  }

  function cleanedDetectionImageUrl(detection: OutfitDetection) {
    return stagedDetectionCleanPreviews[detection.id]?.previewUrl ?? detection.cleaned_image_url ?? null;
  }

  function detectionImageKind(detection: OutfitDetection) {
    return stagedDetectionCleanPreviews[detection.id]?.imageKind ?? (detection.cleaned_image_url ? "cleaned" : null);
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
        sourcePhoto = stagedPreview.file;
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
      setStagedDetectionCleanPreviews((current) => {
        const previousPreview = current[detectionId];
        if (previousPreview) {
          URL.revokeObjectURL(previousPreview.previewUrl);
        }

        return {
          ...current,
          [detectionId]: {
            file: cleanedPreview,
            imageKind: "cleaned",
            previewUrl: URL.createObjectURL(cleanedPreview),
          },
        };
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
      const stagedPreview = stagedDetectionCleanPreviewsRef.current[detectionId];

      if (stagedPreview?.imageKind === "cleaned") {
        sourcePhoto = stagedPreview.file;
      } else if (detection.cleaned_image_url) {
        sourcePhoto = await fetchImageFileFromUrl(
          detection.cleaned_image_url,
          `${detection.suggested_name || detection.category}-cleaned.png`,
        );
      }

      if (!sourcePhoto) {
        throw new Error("Run AI clean image before making a transparent PNG.");
      }

      const transparentPreview = await createTransparentPreviewFile(sourcePhoto);

      setStagedDetectionCleanPreviews((current) => {
        const previousPreview = current[detectionId];
        if (previousPreview) {
          URL.revokeObjectURL(previousPreview.previewUrl);
        }

        return {
          ...current,
          [detectionId]: {
            file: transparentPreview,
            imageKind: "transparent",
            previewUrl: URL.createObjectURL(transparentPreview),
          },
        };
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
    detectionImageKind,
    detectionCleanErrors,
    handleCleanDetectionImage,
    handleMakeDetectionTransparent,
    makingDetectionTransparentIds,
    pendingDetectionCleanModesRef,
    pendingDetectionCleanPromisesRef,
    resetDetectionAiState,
    setStagedDetectionCleanPreview,
    stagedDetectionCleanPreviews,
  };
}
