import type { ClothingItem } from "./closet";

export interface OutfitCollageLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  layer_order: number;
}

interface NumericCollageFrame {
  height: number;
  left: number;
  rotate: number;
  top: number;
  width: number;
  zIndex: number;
}

const MAX_OFF_STAGE_VISIBLE_FRACTION = 0.5;
const BODY_COLUMN_X = 38;
const BODY_COLUMN_WIDTH = 44;
const LEFT_COLUMN_X = 7;
const LEFT_COLUMN_WIDTH = 25;

const CATEGORY_COLLAGE_FRAMES: Record<string, NumericCollageFrame[]> = {
  top: [
    { left: BODY_COLUMN_X, top: 8, width: BODY_COLUMN_WIDTH, height: 40, rotate: 0, zIndex: 3 },
    { left: BODY_COLUMN_X, top: 4, width: BODY_COLUMN_WIDTH, height: 34, rotate: 0, zIndex: 4 },
  ],
  bottom: [
    { left: BODY_COLUMN_X, top: 42, width: BODY_COLUMN_WIDTH, height: 48, rotate: 0, zIndex: 2 },
    { left: BODY_COLUMN_X, top: 50, width: BODY_COLUMN_WIDTH, height: 38, rotate: 0, zIndex: 1 },
  ],
  shoes: [
    { left: LEFT_COLUMN_X, top: 62, width: LEFT_COLUMN_WIDTH, height: 24, rotate: 0, zIndex: 0 },
    { left: LEFT_COLUMN_X, top: 72, width: LEFT_COLUMN_WIDTH, height: 20, rotate: 0, zIndex: 0 },
  ],
  accessory: [
    { left: LEFT_COLUMN_X, top: 14, width: LEFT_COLUMN_WIDTH, height: 24, rotate: 0, zIndex: 1 },
    { left: LEFT_COLUMN_X, top: 38, width: LEFT_COLUMN_WIDTH, height: 22, rotate: 0, zIndex: 1 },
  ],
  bag: [
    { left: LEFT_COLUMN_X, top: 14, width: LEFT_COLUMN_WIDTH, height: 24, rotate: 0, zIndex: 1 },
    { left: LEFT_COLUMN_X, top: 38, width: LEFT_COLUMN_WIDTH, height: 22, rotate: 0, zIndex: 1 },
  ],
  dress: [
    { left: BODY_COLUMN_X, top: 12, width: BODY_COLUMN_WIDTH, height: 72, rotate: 0, zIndex: 2 },
  ],
  outerwear: [
    { left: 35, top: 5, width: 50, height: 48, rotate: 0, zIndex: 4 },
  ],
  intimates: [
    { left: BODY_COLUMN_X, top: 8, width: BODY_COLUMN_WIDTH, height: 40, rotate: 0, zIndex: 3 },
  ],
  swimwear: [
    { left: BODY_COLUMN_X, top: 8, width: BODY_COLUMN_WIDTH, height: 40, rotate: 0, zIndex: 3 },
  ],
};

const DEFAULT_COLLAGE_FRAMES: Record<number, NumericCollageFrame[]> = {
  1: [
    { left: 12, top: 6, width: 76, height: 84, rotate: 0, zIndex: 0 },
  ],
  2: [
    { left: 16, top: 7, width: 68, height: 40, rotate: 0, zIndex: 0 },
    { left: 12, top: 48, width: 76, height: 36, rotate: 0, zIndex: 1 },
  ],
  3: [
    { left: 9, top: 9, width: 38, height: 34, rotate: 0, zIndex: 0 },
    { left: 51, top: 8, width: 35, height: 32, rotate: 0, zIndex: 1 },
    { left: 18, top: 42, width: 64, height: 42, rotate: 0, zIndex: 2 },
  ],
  4: [
    { left: 7, top: 7, width: 36, height: 30, rotate: 0, zIndex: 0 },
    { left: 54, top: 8, width: 31, height: 29, rotate: 0, zIndex: 1 },
    { left: 10, top: 35, width: 34, height: 28, rotate: 0, zIndex: 2 },
    { left: 27, top: 48, width: 50, height: 34, rotate: 0, zIndex: 3 },
  ],
  5: [
    { left: 6, top: 6, width: 28, height: 24, rotate: 0, zIndex: 0 },
    { left: 38, top: 4, width: 30, height: 28, rotate: 0, zIndex: 1 },
    { left: 70, top: 9, width: 20, height: 20, rotate: 0, zIndex: 2 },
    { left: 8, top: 34, width: 28, height: 24, rotate: 0, zIndex: 3 },
    { left: 24, top: 42, width: 58, height: 40, rotate: 0, zIndex: 4 },
  ],
  6: [
    { left: 6, top: 6, width: 26, height: 22, rotate: 0, zIndex: 0 },
    { left: 35, top: 4, width: 28, height: 25, rotate: 0, zIndex: 1 },
    { left: 68, top: 8, width: 20, height: 18, rotate: 0, zIndex: 2 },
    { left: 7, top: 32, width: 24, height: 22, rotate: 0, zIndex: 3 },
    { left: 40, top: 28, width: 42, height: 31, rotate: 0, zIndex: 4 },
    { left: 16, top: 60, width: 64, height: 23, rotate: 0, zIndex: 5 },
  ],
};

function gridFallbackFrame(index: number, count: number): NumericCollageFrame {
  const columns = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(count))));
  const rows = Math.ceil(count / columns);
  const horizontalGap = 4;
  const verticalGap = 4;
  const width = (100 - horizontalGap * (columns + 1)) / columns;
  const height = (100 - verticalGap * (rows + 1)) / rows;
  const column = index % columns;
  const row = Math.floor(index / columns);
  return {
    left: horizontalGap + column * (width + horizontalGap),
    top: verticalGap + row * (height + verticalGap),
    width,
    height,
    rotate: 0,
    zIndex: index,
  };
}

function defaultFrameFor(index: number, count: number): NumericCollageFrame {
  if (count <= 6) {
    return DEFAULT_COLLAGE_FRAMES[count][index];
  }

  return gridFallbackFrame(index, count);
}

function normalizedCollageCategory(item: Pick<ClothingItem, "category">) {
  return item.category?.trim().toLowerCase() ?? "";
}

function categoryFrameFor(
  item: Pick<ClothingItem, "category">,
  categoryCounts: Record<string, number>,
  fallbackIndex: number,
  count: number,
) {
  const category = normalizedCollageCategory(item);
  const frames = CATEGORY_COLLAGE_FRAMES[category];
  const categoryIndex = categoryCounts[category] ?? 0;
  categoryCounts[category] = categoryIndex + 1;

  return frames?.[categoryIndex] ?? defaultFrameFor(fallbackIndex, count);
}

function nextAvailableLayerOrder(preferredLayerOrder: number, usedLayerOrders: Set<number>) {
  let layerOrder = preferredLayerOrder;

  while (usedLayerOrders.has(layerOrder)) {
    layerOrder += 1;
  }

  usedLayerOrders.add(layerOrder);
  return layerOrder;
}

export function buildDefaultOutfitCollageLayouts(
  items: Pick<ClothingItem, "id" | "category">[],
): Record<number, OutfitCollageLayout> {
  const count = items.length;
  const categoryCounts: Record<string, number> = {};
  const usedLayerOrders = new Set<number>();

  return Object.fromEntries(
    items.map((item, index) => {
      const frame = categoryFrameFor(item, categoryCounts, index, count);
      const layerOrder = nextAvailableLayerOrder(frame.zIndex, usedLayerOrders);
      return [
        item.id,
        {
          x: frame.left,
          y: frame.top,
          width: frame.width,
          height: frame.height,
          rotation: frame.rotate,
          layer_order: layerOrder,
        },
      ];
    }),
  );
}

export function resolveOutfitCollageLayouts(
  items: ClothingItem[],
  overrides: Record<number, OutfitCollageLayout> = {},
): Record<number, OutfitCollageLayout> {
  const defaults = buildDefaultOutfitCollageLayouts(items);

  return Object.fromEntries(
    items.map((item) => {
      const preferred = overrides[item.id] ?? item.collage_layout ?? defaults[item.id];
      return [
        item.id,
        {
          x: preferred.x,
          y: preferred.y,
          width: preferred.width,
          height: preferred.height,
          rotation: preferred.rotation,
          layer_order: preferred.layer_order,
        },
      ];
    }),
  );
}

export function sortItemsByCollageLayer(
  items: ClothingItem[],
  layouts: Record<number, OutfitCollageLayout>,
) {
  return [...items].sort((left, right) => {
    const leftOrder = layouts[left.id]?.layer_order ?? left.layer_order ?? 0;
    const rightOrder = layouts[right.id]?.layer_order ?? right.layer_order ?? 0;
    return leftOrder - rightOrder || left.id - right.id;
  });
}

export function reorderCollageLayers(
  layouts: Record<number, OutfitCollageLayout>,
  orderedItemIds: number[],
): Record<number, OutfitCollageLayout> {
  return Object.fromEntries(
    orderedItemIds.map((itemId, index) => [
      itemId,
      {
        ...layouts[itemId],
        layer_order: index,
      },
    ]),
  );
}

export function clampCollageLayout(layout: OutfitCollageLayout): OutfitCollageLayout {
  const width = Math.min(100, Math.max(10, layout.width));
  const height = Math.min(100, Math.max(10, layout.height));
  const minVisibleWidth = width * MAX_OFF_STAGE_VISIBLE_FRACTION;
  const minVisibleHeight = height * MAX_OFF_STAGE_VISIBLE_FRACTION;
  const minX = minVisibleWidth - width;
  const maxX = 100 - minVisibleWidth;
  const minY = minVisibleHeight - height;
  const maxY = 100 - minVisibleHeight;
  const x = Math.min(maxX, Math.max(minX, layout.x));
  const y = Math.min(maxY, Math.max(minY, layout.y));

  return {
    ...layout,
    x,
    y,
    width,
    height,
    rotation: Number.isFinite(layout.rotation) ? layout.rotation : 0,
  };
}
