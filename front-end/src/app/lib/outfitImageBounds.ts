const EDGE_BACKGROUND_ALPHA_THRESHOLD = 8;
const EDGE_BACKGROUND_MIN_RGB = 250;
const EDGE_BACKGROUND_MAX_RGB_DELTA = 6;
const MIN_OPAQUE_EDGE_TRIM_FRACTION = 0.02;
const MIN_OPAQUE_EDGE_AREA_REDUCTION = 0.08;

export interface ImageContentBounds {
  aspectRatio: number;
  heightFraction: number;
  leftFraction: number;
  topFraction: number;
  widthFraction: number;
}

interface MeasureImageContentBoundsOptions {
  imageUrl: string;
}

interface LoadedCanvasImage {
  cleanup: () => void;
  image: HTMLImageElement;
}

const imageContentBoundsCache = new Map<string, ImageContentBounds | null>();
const imageContentBoundsPromiseCache = new Map<string, Promise<ImageContentBounds | null>>();

export function measureImageContentBounds({
  imageUrl,
}: MeasureImageContentBoundsOptions): Promise<ImageContentBounds | null> {
  if (imageContentBoundsCache.has(imageUrl)) {
    return Promise.resolve(imageContentBoundsCache.get(imageUrl) ?? null);
  }

  const pendingBounds = imageContentBoundsPromiseCache.get(imageUrl);
  if (pendingBounds) {
    return pendingBounds;
  }

  const measurementPromise = computeImageContentBounds({
    imageUrl,
  }).then((nextBounds) => {
    imageContentBoundsCache.set(imageUrl, nextBounds);
    imageContentBoundsPromiseCache.delete(imageUrl);
    return nextBounds;
  });

  imageContentBoundsPromiseCache.set(imageUrl, measurementPromise);
  return measurementPromise;
}

async function computeImageContentBounds({
  imageUrl,
}: MeasureImageContentBoundsOptions): Promise<ImageContentBounds | null> {
  let loadedImage: LoadedCanvasImage | null = null;
  let fallback: ImageContentBounds | null = null;

  try {
    loadedImage = await loadCanvasSafeImage(imageUrl);
    const image = loadedImage.image;
    const width = image.naturalWidth;
    const height = image.naturalHeight;

    if (!width || !height) {
      return null;
    }

    fallback = fullImageContentBounds(width, height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return fallback;
    }

    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const data = context.getImageData(0, 0, width, height).data;
    const alphaBounds = detectContentBounds(data, width, height, isTransparentBackgroundPixel);
    if (alphaBounds && !isFullImageContentBounds(alphaBounds)) {
      return alphaBounds;
    }

    const opaqueWhiteBounds = detectContentBounds(data, width, height, isOpaqueNeutralWhitePixel);
    if (opaqueWhiteBounds && shouldUseOpaqueWhiteTrim(opaqueWhiteBounds)) {
      return opaqueWhiteBounds;
    }

    return alphaBounds ?? fallback;
  } catch {
    return fallback;
  } finally {
    loadedImage?.cleanup();
  }
}

function detectContentBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  isBackgroundPixel: (data: Uint8ClampedArray, pixelIndex: number) => boolean,
) {
  const backgroundMask = buildEdgeBackgroundMask(data, width, height, isBackgroundPixel);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x;
      if (backgroundMask[pixelIndex]) {
        continue;
      }

      if (x < minX) {
        minX = x;
      }
      if (y < minY) {
        minY = y;
      }
      if (x > maxX) {
        maxX = x;
      }
      if (y > maxY) {
        maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return fullImageContentBounds(width, height);
  }

  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;

  return {
    leftFraction: minX / width,
    topFraction: minY / height,
    widthFraction: contentWidth / width,
    heightFraction: contentHeight / height,
    aspectRatio: contentWidth / Math.max(contentHeight, 1),
  };
}

export function isFullImageContentBounds(bounds: ImageContentBounds) {
  return (
    nearlyEqual(bounds.leftFraction, 0, 0.001)
    && nearlyEqual(bounds.topFraction, 0, 0.001)
    && nearlyEqual(bounds.widthFraction, 1, 0.001)
    && nearlyEqual(bounds.heightFraction, 1, 0.001)
  );
}

function shouldUseOpaqueWhiteTrim(bounds: ImageContentBounds) {
  if (isFullImageContentBounds(bounds)) {
    return false;
  }

  const rightTrim = 1 - (bounds.leftFraction + bounds.widthFraction);
  const bottomTrim = 1 - (bounds.topFraction + bounds.heightFraction);
  const trimmedSides = [
    bounds.leftFraction,
    bounds.topFraction,
    rightTrim,
    bottomTrim,
  ].filter((trimFraction) => trimFraction >= MIN_OPAQUE_EDGE_TRIM_FRACTION).length;
  const visibleAreaFraction = bounds.widthFraction * bounds.heightFraction;

  return (
    trimmedSides >= 2
    && 1 - visibleAreaFraction >= MIN_OPAQUE_EDGE_AREA_REDUCTION
  );
}

function fullImageContentBounds(width: number, height: number): ImageContentBounds {
  return {
    aspectRatio: width / Math.max(height, 1),
    heightFraction: 1,
    leftFraction: 0,
    topFraction: 0,
    widthFraction: 1,
  };
}

function buildEdgeBackgroundMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  isBackgroundPixel: (data: Uint8ClampedArray, pixelIndex: number) => boolean,
) {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let queueStart = 0;
  let queueEnd = 0;

  function enqueue(x: number, y: number) {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const pixelIndex = y * width + x;
    if (visited[pixelIndex] || !isBackgroundPixel(data, pixelIndex)) {
      return;
    }

    visited[pixelIndex] = 1;
    queue[queueEnd] = pixelIndex;
    queueEnd += 1;
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }

  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (queueStart < queueEnd) {
    const pixelIndex = queue[queueStart];
    queueStart += 1;

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);

    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }

  return visited;
}

function isTransparentBackgroundPixel(data: Uint8ClampedArray, pixelIndex: number) {
  const alpha = data[pixelIndex * 4 + 3];
  return alpha <= EDGE_BACKGROUND_ALPHA_THRESHOLD;
}

function isOpaqueNeutralWhitePixel(data: Uint8ClampedArray, pixelIndex: number) {
  const channelOffset = pixelIndex * 4;
  const red = data[channelOffset];
  const green = data[channelOffset + 1];
  const blue = data[channelOffset + 2];
  const alpha = data[channelOffset + 3];
  const maxChannel = Math.max(red, green, blue);
  const minChannel = Math.min(red, green, blue);

  return (
    alpha > EDGE_BACKGROUND_ALPHA_THRESHOLD
    && red >= EDGE_BACKGROUND_MIN_RGB
    && green >= EDGE_BACKGROUND_MIN_RGB
    && blue >= EDGE_BACKGROUND_MIN_RGB
    && maxChannel - minChannel <= EDGE_BACKGROUND_MAX_RGB_DELTA
  );
}

async function loadCanvasSafeImage(imageUrl: string): Promise<LoadedCanvasImage> {
  if (imageUrl.startsWith("data:") || imageUrl.startsWith("blob:")) {
    return {
      cleanup: () => {},
      image: await loadImageElement(imageUrl),
    };
  }

  const response = await fetch(imageUrl, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Unable to load image ${imageUrl}: ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    return {
      cleanup: () => URL.revokeObjectURL(objectUrl),
      image: await loadImageElement(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to decode image: ${src}`));
    image.src = src;
  });
}

function nearlyEqual(left: number, right: number, tolerance = 0.002) {
  return Math.abs(left - right) <= tolerance;
}
