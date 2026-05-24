import { clampCollageLayout, type OutfitCollageLayout } from "./outfitCollage.ts";

export const COLLAGE_STAGE_ASPECT_RATIO = 4 / 5;

interface ResolveResizeAspectRatioOptions {
  contentBoundsAspectRatio?: number;
  intrinsicAspectRatio?: number;
  layout: OutfitCollageLayout;
}

export function normalizeOutfitCollageLayoutToAspectRatio(
  layout: OutfitCollageLayout,
  aspectRatio?: number,
): OutfitCollageLayout {
  if (!aspectRatio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return clampCollageLayout(layout);
  }

  const safeLayout = clampCollageLayout(layout);
  const currentRatio = (
    safeLayout.width * COLLAGE_STAGE_ASPECT_RATIO
  ) / Math.max(safeLayout.height, 0.001);

  if (Math.abs(currentRatio - aspectRatio) < 0.001) {
    return safeLayout;
  }

  if (currentRatio > aspectRatio) {
    const width = (safeLayout.height * aspectRatio) / COLLAGE_STAGE_ASPECT_RATIO;
    return clampCollageLayout({
      ...safeLayout,
      x: safeLayout.x + (safeLayout.width - width) / 2,
      width,
    });
  }

  const height = (safeLayout.width * COLLAGE_STAGE_ASPECT_RATIO) / aspectRatio;
  return clampCollageLayout({
    ...safeLayout,
    y: safeLayout.y + (safeLayout.height - height) / 2,
    height,
  });
}

export function resolveOutfitCollageResizeAspectRatio({
  contentBoundsAspectRatio,
  intrinsicAspectRatio,
  layout,
}: ResolveResizeAspectRatioOptions) {
  return (
    contentBoundsAspectRatio
    ?? intrinsicAspectRatio
    ?? (layout.width / Math.max(layout.height, 0.001))
  );
}
