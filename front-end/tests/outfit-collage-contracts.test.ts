import assert from "node:assert/strict";
import test from "node:test";

import { resolveOutfitCollageLayouts } from "../src/app/lib/outfitCollage.ts";
import {
  COLLAGE_STAGE_ASPECT_RATIO,
  normalizeOutfitCollageLayoutToAspectRatio,
  resolveOutfitCollageResizeAspectRatio,
} from "../src/app/lib/outfitCollageRenderMath.ts";

function collageFrameRatio(layout: { width: number; height: number }) {
  return (layout.width * COLLAGE_STAGE_ASPECT_RATIO) / Math.max(layout.height, 0.001);
}

test("saved collage layouts seed the editor with the same normalized preview frames", () => {
  const items = [
    {
      id: 11,
      layer_order: 0,
      collage_layout: {
        x: 18,
        y: 10,
        width: 44,
        height: 48,
        rotation: -8,
        layer_order: 0,
      },
    },
    {
      id: 24,
      layer_order: 1,
      collage_layout: {
        x: 36,
        y: 32,
        width: 40,
        height: 42,
        rotation: 6,
        layer_order: 1,
      },
    },
  ] as const;

  const aspectRatioByItemId = {
    11: 0.72,
    24: 0.58,
  } as const;

  const editorSeedLayouts = resolveOutfitCollageLayouts(items as never);
  const savedDisplayLayouts = Object.fromEntries(
    items.map((item) => [
      item.id,
      normalizeOutfitCollageLayoutToAspectRatio(
        item.collage_layout,
        aspectRatioByItemId[item.id as keyof typeof aspectRatioByItemId],
      ),
    ]),
  );
  const editorDisplayLayouts = Object.fromEntries(
    items.map((item) => [
      item.id,
      normalizeOutfitCollageLayoutToAspectRatio(
        editorSeedLayouts[item.id],
        aspectRatioByItemId[item.id as keyof typeof aspectRatioByItemId],
      ),
    ]),
  );

  assert.deepEqual(editorSeedLayouts[11], items[0].collage_layout);
  assert.deepEqual(editorSeedLayouts[24], items[1].collage_layout);
  assert.deepEqual(editorDisplayLayouts, savedDisplayLayouts);
});

test("normalized collage layouts are idempotent across repeated saved/editor renders", () => {
  const layout = {
    x: 12,
    y: 48,
    width: 76,
    height: 36,
    rotation: 2,
    layer_order: 1,
  };

  const once = normalizeOutfitCollageLayoutToAspectRatio(layout, 0.64);
  const twice = normalizeOutfitCollageLayoutToAspectRatio(once, 0.64);

  assert.deepEqual(twice, once);
});

test("resize ratio fallback prefers the real image ratio over the current layout frame ratio", () => {
  const intrinsicAspectRatio = 0.64;
  const initialLayout = {
    x: 12,
    y: 41.19,
    width: 76,
    height: 36,
    rotation: 2,
    layer_order: 1,
  };
  const laterLayout = {
    x: 40.4,
    y: 63.26,
    width: 47.06,
    height: 14.27,
    rotation: 2,
    layer_order: 1,
  };

  assert.notEqual(collageFrameRatio(initialLayout), intrinsicAspectRatio);
  assert.notEqual(collageFrameRatio(laterLayout), intrinsicAspectRatio);

  assert.equal(
    resolveOutfitCollageResizeAspectRatio({
      intrinsicAspectRatio,
      layout: initialLayout,
    }),
    intrinsicAspectRatio,
  );
  assert.equal(
    resolveOutfitCollageResizeAspectRatio({
      intrinsicAspectRatio,
      layout: laterLayout,
    }),
    intrinsicAspectRatio,
  );
});
