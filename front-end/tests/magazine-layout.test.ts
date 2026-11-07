import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeMagazinePageLayouts,
  resolveMagazinePageLayout,
  updateMagazinePageElement,
} from "../src/app/lib/magazineLayout.ts";

test("magazine pages receive editable defaults without mutating stored layouts", () => {
  const stored = { "outfit:19": { image_mode: "modeled" as const } };
  const resolved = resolveMagazinePageLayout("outfit:19", stored["outfit:19"], {
    title: "Gallery Dinner",
    body: "Polished layers",
    imageMode: "flatlay",
  });

  assert.equal(resolved.image_mode, "modeled");
  assert.equal(resolved.title?.text, "Gallery Dinner");
  assert.equal(resolved.image?.width, 68);
  assert.deepEqual(stored, { "outfit:19": { image_mode: "modeled" } });
});

test("moving magazine elements persists only the edited page and element", () => {
  const resolved = resolveMagazinePageLayout("cover", undefined, {
    title: "Paris Weekend",
    body: "Three days",
  });
  const layouts = updateMagazinePageElement({}, "cover", "title", { x: 21, y: 27 }, resolved);

  assert.deepEqual(layouts.cover.title, {
    text: "Paris Weekend",
    width: 84,
    x: 21,
    y: 27,
  });
  assert.equal(layouts.cover.body, undefined);
});

test("magazine layout normalization rejects malformed values and clamps positions", () => {
  const layouts = normalizeMagazinePageLayouts({
    cover: {
      image_mode: "unknown",
      title: { text: "Cover", width: 300, x: -500, y: 400 },
      body: "invalid",
    },
  });

  assert.equal(layouts.cover.image_mode, undefined);
  assert.deepEqual(layouts.cover.title, {
    text: "Cover",
    width: 100,
    x: -50,
    y: 98,
  });
  assert.equal(layouts.cover.body, undefined);
});
