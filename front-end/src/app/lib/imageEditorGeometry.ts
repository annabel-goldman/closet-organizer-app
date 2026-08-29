export interface ImageDimensions {
  height: number;
  width: number;
}

export function fitImageWithinViewport(
  naturalSize: ImageDimensions,
  viewportSize: ImageDimensions,
  inset = 0,
) {
  const availableWidth = Math.max(0, viewportSize.width - inset);
  const availableHeight = Math.max(0, viewportSize.height - inset);

  if (
    naturalSize.width <= 0
    || naturalSize.height <= 0
    || availableWidth <= 0
    || availableHeight <= 0
  ) {
    return null;
  }

  const scale = Math.min(
    availableWidth / naturalSize.width,
    availableHeight / naturalSize.height,
  );

  return {
    height: naturalSize.height * scale,
    width: naturalSize.width * scale,
  };
}
