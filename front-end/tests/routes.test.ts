import assert from "node:assert/strict";
import test from "node:test";

import { getRouteFromLocation, isOutfitRoute } from "../src/app/lib/routes.ts";

test("magazine routes distinguish creation, full-page editing, and reading", () => {
  const createRoute = getRouteFromLocation("/magazines/new", "");
  const editRoute = getRouteFromLocation("/magazines/42/edit", "");
  const readerRoute = getRouteFromLocation("/magazines/42", "");

  assert.deepEqual(createRoute, { kind: "magazine-editor", magazineId: null });
  assert.deepEqual(editRoute, { kind: "magazine-editor", magazineId: 42 });
  assert.deepEqual(readerRoute, { kind: "magazine-reader", magazineId: 42 });
  assert.equal(isOutfitRoute(editRoute), true);
  assert.equal(isOutfitRoute(readerRoute), true);
});
