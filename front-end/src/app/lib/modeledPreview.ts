import type { AiWorkflow } from "./closet";
import { resolveActiveStorageProxyUrl } from "./imageSources.ts";

export type OutfitPreviewSlide = "flatlay" | "modeled";

export type OutfitGalleryModelPreview =
  | { kind: "image"; imageUrl: string }
  | { kind: "placeholder"; imageUrl: null };

export function resolveModeledWorkflowImageUrl(workflow: AiWorkflow | null | undefined) {
  if (!workflow) {
    return null;
  }

  const imageUrls = workflow.stages.flatMap((stage) =>
    (stage.artifacts ?? []).flatMap((artifact) =>
      artifact.file_url && !["rejected", "deleted", "failed"].includes(artifact.status)
        ? [artifact.file_url]
        : [],
    ),
  );

  const latestImageUrl = imageUrls.at(-1);
  if (!latestImageUrl) {
    return null;
  }

  return resolveActiveStorageProxyUrl(latestImageUrl);
}

export function resolveOutfitGalleryModelPreview(
  workflow: AiWorkflow | null | undefined,
): OutfitGalleryModelPreview {
  const imageUrl = resolveModeledWorkflowImageUrl(workflow);
  return imageUrl
    ? { kind: "image", imageUrl }
    : { kind: "placeholder", imageUrl: null };
}

export function resolveOutfitPreviewSlideAfterSwipe({
  currentSlide,
  deltaX,
  deltaY,
  hasModeledImage,
  threshold = 44,
}: {
  currentSlide: OutfitPreviewSlide;
  deltaX: number;
  deltaY: number;
  hasModeledImage: boolean;
  threshold?: number;
}): OutfitPreviewSlide {
  if (!hasModeledImage || Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY)) {
    return currentSlide;
  }

  return deltaX < 0 ? "modeled" : "flatlay";
}
