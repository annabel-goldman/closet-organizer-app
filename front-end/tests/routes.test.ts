import assert from "node:assert/strict";
import test from "node:test";

import { getRouteFromLocation, isDecorationsRoute, isMagazineRoute, isOutfitRoute } from "../src/app/lib/routes.ts";

test("magazine routes distinguish creation, full-page editing, and reading", () => {
  const indexRoute = getRouteFromLocation("/magazines", "");
  const createRoute = getRouteFromLocation("/magazines/new", "");
  const editRoute = getRouteFromLocation("/magazines/42/edit", "");
  const readerRoute = getRouteFromLocation("/magazines/42", "");

  assert.deepEqual(indexRoute, { kind: "magazines" });
  assert.deepEqual(createRoute, { kind: "magazine-editor", magazineId: null });
  assert.deepEqual(editRoute, { kind: "magazine-editor", magazineId: 42 });
  assert.deepEqual(readerRoute, { kind: "magazine-reader", magazineId: 42 });
  assert.equal(isMagazineRoute(indexRoute), true);
  assert.equal(isMagazineRoute(editRoute), true);
  assert.equal(isMagazineRoute(readerRoute), true);
  assert.equal(isOutfitRoute(editRoute), false);
  assert.deepEqual(getRouteFromLocation("/outfits", "?view=magazines"), { kind: "magazines" });
});

test("decorations have a private library route", () => {
  const route = getRouteFromLocation("/decorations", "");
  assert.deepEqual(route, { kind: "decorations" });
  assert.equal(isDecorationsRoute(route), true);
});
