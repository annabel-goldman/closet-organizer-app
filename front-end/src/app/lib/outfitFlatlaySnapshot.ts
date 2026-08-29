import type { ClothingItem, OutfitDecoration } from "./closet.ts";
import { loadImageSource } from "./imageSources.ts";
import {
  resolveOutfitCollageLayouts,
  sortItemsByCollageLayer,
  type OutfitCollageLayout,
} from "./outfitCollage.ts";
import {
  COLLAGE_STAGE_ASPECT_RATIO,
  resolveOutfitCollageMediaBox,
} from "./outfitCollageRenderMath.ts";
import { measureImageContentBounds, type ImageContentBounds } from "./outfitImageBounds.ts";

const SNAPSHOT_WIDTH = 1024;
const SNAPSHOT_HEIGHT = Math.round(SNAPSHOT_WIDTH / COLLAGE_STAGE_ASPECT_RATIO);

interface CreateOutfitFlatlaySnapshotOptions {
  items: ClothingItem[];
  layouts?: Record<number, OutfitCollageLayout>;
  decorations?: OutfitDecoration[];
  outfitName: string;
}

interface LoadedSnapshotImage {
  bounds: ImageContentBounds | null;
  cleanup: () => void;
  image: HTMLImageElement;
  layout: OutfitCollageLayout;
}

export async function createOutfitFlatlaySnapshot({
  items,
  layouts = {},
  outfitName,
  decorations = [],
}: CreateOutfitFlatlaySnapshotOptions) {
  if (items.length === 0 || items.some((item) => !item.image_url)) {
    throw new Error("Every outfit item needs a photo before its flat lay can be captured.");
  }

  const resolvedLayouts = resolveOutfitCollageLayouts(items, layouts);
  const orderedItems = sortItemsByCollageLayer(items, resolvedLayouts);
  const loadedImages: LoadedSnapshotImage[] = [];
  const loadedDecorations: Array<{ cleanup: () => void; image: HTMLImageElement; placement: OutfitDecoration }> = [];

  try {
    for (const item of orderedItems) {
      const loaded = await loadSnapshotImage(item.image_url!);
      try {
        const bounds = await measureImageContentBounds({ imageUrl: item.image_url! });
        loadedImages.push({
          ...loaded,
          bounds,
          layout: resolvedLayouts[item.id],
        });
      } catch (error) {
        loaded.cleanup();
        throw error;
      }
    }
    for (const placement of decorations) {
      const loaded = await loadSnapshotImage(placement.image_url);
      loadedDecorations.push({ ...loaded, placement });
    }

    const canvas = document.createElement("canvas");
    canvas.width = SNAPSHOT_WIDTH;
    canvas.height = SNAPSHOT_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("This browser could not prepare the flat-lay reference image.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    loadedImages.forEach((loaded) => drawSnapshotItem(context, loaded));
    loadedDecorations
      .sort((left, right) => left.placement.layer_order - right.placement.layer_order)
      .forEach((loaded) => drawSnapshotDecoration(context, loaded));

    const blob = await canvasToBlob(canvas);
    return new File(
      [blob],
      `${fileSafeName(outfitName) || "outfit"}-flatlay-reference.png`,
      { type: "image/png" },
    );
  } finally {
    loadedImages.forEach((loaded) => loaded.cleanup());
    loadedDecorations.forEach((loaded) => loaded.cleanup());
  }
}

function drawSnapshotDecoration(
  context: CanvasRenderingContext2D,
  { image, placement }: { image: HTMLImageElement; placement: OutfitDecoration },
) {
  const width = (placement.width / 100) * SNAPSHOT_WIDTH;
  const height = width * (image.naturalHeight / Math.max(image.naturalWidth, 1));
  const x = (placement.x / 100) * SNAPSHOT_WIDTH;
  const y = (placement.y / 100) * SNAPSHOT_HEIGHT;
  context.save();
  context.translate(x + width / 2, y + height / 2);
  context.rotate((placement.rotation * Math.PI) / 180);
  context.drawImage(image, -width / 2, -height / 2, width, height);
  context.restore();
}

function drawSnapshotItem(
  context: CanvasRenderingContext2D,
  { bounds, image, layout }: LoadedSnapshotImage,
) {
  const frameX = (layout.x / 100) * SNAPSHOT_WIDTH;
  const frameY = (layout.y / 100) * SNAPSHOT_HEIGHT;
  const frameWidth = (layout.width / 100) * SNAPSHOT_WIDTH;
  const frameHeight = (layout.height / 100) * SNAPSHOT_HEIGHT;
  const centerX = frameX + frameWidth / 2;
  const centerY = frameY + frameHeight / 2;
  const sourceX = (bounds?.leftFraction ?? 0) * image.naturalWidth;
  const sourceY = (bounds?.topFraction ?? 0) * image.naturalHeight;
  const sourceWidth = (bounds?.widthFraction ?? 1) * image.naturalWidth;
  const sourceHeight = (bounds?.heightFraction ?? 1) * image.naturalHeight;
  const mediaBox = resolveOutfitCollageMediaBox(
    layout,
    bounds?.aspectRatio ?? (sourceWidth / Math.max(sourceHeight, 1)),
  );
  const destinationX = -frameWidth / 2 + (mediaBox.left / 100) * frameWidth;
  const destinationY = -frameHeight / 2 + (mediaBox.top / 100) * frameHeight;
  const destinationWidth = (mediaBox.width / 100) * frameWidth;
  const destinationHeight = (mediaBox.height / 100) * frameHeight;

  context.save();
  context.translate(centerX, centerY);
  context.rotate((layout.rotation * Math.PI) / 180);
  context.beginPath();
  context.rect(-frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight);
  context.clip();
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    destinationX,
    destinationY,
    destinationWidth,
    destinationHeight,
  );
  context.restore();
}

async function loadSnapshotImage(imageUrl: string) {
  return loadImageSource(
    imageUrl,
    "An outfit image could not be decoded for the flat-lay reference.",
  );
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("The flat-lay reference image could not be created."));
      }
    }, "image/png");
  });
}

function fileSafeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
