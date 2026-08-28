import type { ClothingItem } from "./closet.ts";
import {
  resolveOutfitCollageLayouts,
  sortItemsByCollageLayer,
  type OutfitCollageLayout,
} from "./outfitCollage.ts";
import {
  COLLAGE_STAGE_ASPECT_RATIO,
  normalizeOutfitCollageLayoutToAspectRatio,
} from "./outfitCollageRenderMath.ts";
import { measureImageContentBounds, type ImageContentBounds } from "./outfitImageBounds.ts";

const SNAPSHOT_WIDTH = 1024;
const SNAPSHOT_HEIGHT = Math.round(SNAPSHOT_WIDTH / COLLAGE_STAGE_ASPECT_RATIO);

interface CreateOutfitFlatlaySnapshotOptions {
  items: ClothingItem[];
  layouts?: Record<number, OutfitCollageLayout>;
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
}: CreateOutfitFlatlaySnapshotOptions) {
  if (items.length === 0 || items.some((item) => !item.image_url)) {
    throw new Error("Every outfit item needs a photo before its flat lay can be captured.");
  }

  const resolvedLayouts = resolveOutfitCollageLayouts(items, layouts);
  const orderedItems = sortItemsByCollageLayer(items, resolvedLayouts);
  const loadedImages: LoadedSnapshotImage[] = [];

  try {
    for (const item of orderedItems) {
      const loaded = await loadSnapshotImage(item.image_url!);
      try {
        const bounds = await measureImageContentBounds({ imageUrl: item.image_url! });
        const intrinsicAspectRatio = loaded.image.naturalWidth / Math.max(loaded.image.naturalHeight, 1);
        loadedImages.push({
          ...loaded,
          bounds,
          layout: normalizeOutfitCollageLayoutToAspectRatio(
            resolvedLayouts[item.id],
            bounds?.aspectRatio ?? intrinsicAspectRatio,
          ),
        });
      } catch (error) {
        loaded.cleanup();
        throw error;
      }
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

    const blob = await canvasToBlob(canvas);
    return new File(
      [blob],
      `${fileSafeName(outfitName) || "outfit"}-flatlay-reference.png`,
      { type: "image/png" },
    );
  } finally {
    loadedImages.forEach((loaded) => loaded.cleanup());
  }
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
    -frameWidth / 2,
    -frameHeight / 2,
    frameWidth,
    frameHeight,
  );
  context.restore();
}

async function loadSnapshotImage(imageUrl: string) {
  const response = await fetch(imageUrl, { credentials: "include" });
  if (!response.ok) {
    throw new Error("One of this outfit's images could not be loaded for the flat-lay reference.");
  }

  const objectUrl = URL.createObjectURL(await response.blob());

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
    image.onerror = () => reject(new Error("An outfit image could not be decoded for the flat-lay reference."));
    image.src = src;
  });
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
