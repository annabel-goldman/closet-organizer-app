import assert from "node:assert/strict";
import test from "node:test";

import { resolveOutfitCollageLayouts } from "../src/app/lib/outfitCollage.ts";
import {
  COLLAGE_STAGE_ASPECT_RATIO,
  resolveOutfitCollageMediaBox,
  resolveOutfitCollageResizeAspectRatio,
} from "../src/app/lib/outfitCollageRenderMath.ts";

function collageFrameRatio(layout: { width: number; height: number }) {
  return (layout.width * COLLAGE_STAGE_ASPECT_RATIO) / Math.max(layout.height, 0.001);
}

test("saved collage frames remain authoritative when image measurements arrive", () => {
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

  const editorSeedLayouts = resolveOutfitCollageLayouts(items as never);
  const originalLayouts = structuredClone(editorSeedLayouts);

  resolveOutfitCollageMediaBox(editorSeedLayouts[11], 0.72);
  resolveOutfitCollageMediaBox(editorSeedLayouts[24], 0.58);

  assert.deepEqual(editorSeedLayouts[11], items[0].collage_layout);
  assert.deepEqual(editorSeedLayouts[24], items[1].collage_layout);
  assert.deepEqual(editorSeedLayouts, originalLayouts);
});

test("category defaults place tops above bottoms with accessories on the left and no rotation", () => {
  const items = [
    { id: 1, category: "top" },
    { id: 2, category: "bottom" },
    { id: 3, category: "shoes" },
    { id: 4, category: "accessory" },
  ];

  const layouts = resolveOutfitCollageLayouts(items as never);
  const top = layouts[1];
  const bottom = layouts[2];
  const shoes = layouts[3];
  const accessory = layouts[4];

  assert.deepEqual(
    Object.values(layouts).map((layout) => layout.rotation),
    [ 0, 0, 0, 0 ],
  );
  assert.equal(top.x, bottom.x);
  assert.equal(top.width, bottom.width);
  assert.ok(top.y < bottom.y);
  assert.ok(top.layer_order > bottom.layer_order);
  assert.ok(shoes.x < top.x);
  assert.ok(accessory.x < top.x);
  assert.ok(accessory.y < shoes.y);
});

test("contained media boxes preserve tall and wide item proportions without changing their frame", () => {
  const layout = {
    x: 20,
    y: 20,
    width: 40,
    height: 40,
    rotation: 0,
    layer_order: 0,
  };
  const originalLayout = { ...layout };

  const tall = resolveOutfitCollageMediaBox(layout, 0.4);
  const wide = resolveOutfitCollageMediaBox(layout, 2);

  assert.deepEqual(tall, { height: 100, left: 25, top: 0, width: 50 });
  assert.deepEqual(wide, { height: 40, left: 0, top: 30, width: 100 });
  assert.deepEqual(layout, originalLayout);
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
