import assert from "node:assert/strict";
import test from "node:test";

import { fitImageWithinViewport } from "../src/app/lib/imageEditorGeometry.ts";

function assertSameAspectRatio(
  left: { width: number; height: number },
  right: { width: number; height: number },
) {
  assert.ok(Math.abs((left.width / left.height) - (right.width / right.height)) < 1e-12);
}

test("image editor fitting preserves a portrait source aspect ratio exactly", () => {
  const source = { width: 2048, height: 3072 };
  const fitted = fitImageWithinViewport(source, { width: 980, height: 720 }, 32);

  assert.ok(fitted);
  assertSameAspectRatio(fitted, source);
  assert.ok(fitted.width <= 948);
  assert.ok(fitted.height <= 688);
});

test("image editor fitting preserves a landscape source aspect ratio exactly", () => {
  const source = { width: 4032, height: 3024 };
  const fitted = fitImageWithinViewport(source, { width: 720, height: 940 }, 32);

  assert.ok(fitted);
  assertSameAspectRatio(fitted, source);
  assert.ok(fitted.width <= 688);
  assert.ok(fitted.height <= 908);
});

test("image editor fitting waits for valid source and viewport dimensions", () => {
  assert.equal(fitImageWithinViewport({ width: 0, height: 0 }, { width: 800, height: 600 }, 32), null);
  assert.equal(fitImageWithinViewport({ width: 800, height: 600 }, { width: 20, height: 20 }, 32), null);
});
