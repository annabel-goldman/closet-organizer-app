import assert from "node:assert/strict";
import test from "node:test";

import { mapWithConcurrency } from "../src/app/lib/asyncPool.ts";

test("mapWithConcurrency caps active work and preserves result order", async () => {
  let active = 0;
  let maximumActive = 0;
  const release: Array<() => void> = [];

  const pending = mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise<void>((resolve) => release.push(resolve));
    active -= 1;
    return value * 10;
  });

  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.equal(active, 2);
  release.shift()?.();
  release.shift()?.();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.equal(active, 2);
  release.shift()?.();
  release.shift()?.();

  const results = await pending;
  assert.equal(maximumActive, 2);
  assert.deepEqual(results, [
    { status: "fulfilled", value: 10 },
    { status: "fulfilled", value: 20 },
    { status: "fulfilled", value: 30 },
    { status: "fulfilled", value: 40 },
  ]);
});

test("mapWithConcurrency isolates failures so later work still completes", async () => {
  const results = await mapWithConcurrency([1, 2, 3], 2, async (value) => {
    if (value === 2) {
      throw new Error("bad photo");
    }

    return value;
  });

  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.equal(results[2].status, "fulfilled");
});
