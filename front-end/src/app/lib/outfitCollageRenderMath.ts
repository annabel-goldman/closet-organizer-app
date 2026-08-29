import type { OutfitCollageLayout } from "./outfitCollage.ts";

export const COLLAGE_STAGE_ASPECT_RATIO = 4 / 5;

interface ResolveResizeAspectRatioOptions {
  contentBoundsAspectRatio?: number;
  intrinsicAspectRatio?: number;
  layout: OutfitCollageLayout;
}

export interface OutfitCollageMediaBox {
  height: number;
  left: number;
  top: number;
  width: number;
}

export function resolveOutfitCollageMediaBox(
  layout: OutfitCollageLayout,
  aspectRatio?: number,
): OutfitCollageMediaBox {
  const fullFrame = { height: 100, left: 0, top: 0, width: 100 };
  if (!aspectRatio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return fullFrame;
  }

  const frameAspectRatio = (
    layout.width * COLLAGE_STAGE_ASPECT_RATIO
  ) / Math.max(layout.height, 0.001);

  if (Math.abs(frameAspectRatio - aspectRatio) < 0.001) {
    return fullFrame;
  }

  if (frameAspectRatio > aspectRatio) {
    const width = (aspectRatio / frameAspectRatio) * 100;
    return {
      height: 100,
      left: (100 - width) / 2,
      top: 0,
      width,
    };
  }

  const height = (frameAspectRatio / aspectRatio) * 100;
  return {
    height,
    left: 0,
    top: (100 - height) / 2,
    width: 100,
  };
}

export function resolveOutfitCollageResizeAspectRatio({
  contentBoundsAspectRatio,
  intrinsicAspectRatio,
  layout,
}: ResolveResizeAspectRatioOptions) {
  return (
    contentBoundsAspectRatio
    ?? intrinsicAspectRatio
    ?? ((layout.width * COLLAGE_STAGE_ASPECT_RATIO) / Math.max(layout.height, 0.001))
  );
}
