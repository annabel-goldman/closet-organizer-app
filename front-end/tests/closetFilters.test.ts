import assert from "node:assert/strict";
import test from "node:test";

import type { ClothingItem, Outfit } from "../src/app/lib/closet.ts";
import {
  formatOutfitSearchSuggestionDetail,
  getClosetSearchSuggestions,
  getOutfitSearchSuggestions,
  matchesOutfitSearchQuery,
  matchesSearchQuery,
  termMatchesInHaystack,
} from "../src/app/lib/closetFilters.ts";

function makeItem(overrides: Partial<ClothingItem> & Pick<ClothingItem, "id" | "name">): ClothingItem {
  return {
    id: overrides.id,
    name: overrides.name,
    size: overrides.size ?? "medium",
    date: overrides.date ?? null,
    user_id: overrides.user_id ?? 1,
    tags: overrides.tags ?? [],
    brand: overrides.brand ?? null,
    category: overrides.category ?? null,
    style_notes: overrides.style_notes ?? null,
    created_at: overrides.created_at,
  };
}

test("termMatchesInHaystack supports substring matches", () => {
  assert.equal(termMatchesInHaystack("blue", "navy blue sweater"), true);
});

test("termMatchesInHaystack supports fuzzy typo matches", () => {
  assert.equal(termMatchesInHaystack("swetshirt", "gray sweatshirt cotton"), true);
  assert.equal(termMatchesInHaystack("nikee", "nike running shoes"), true);
});

test("matchesSearchQuery requires every term to match", () => {
  const item = makeItem({ id: 1, name: "Navy Wool Sweater", tags: ["wool", "blue"] });

  assert.equal(matchesSearchQuery(item, "navy wool"), true);
  assert.equal(matchesSearchQuery(item, "navy leather"), false);
});

test("matchesOutfitSearchQuery includes outfit details and contained pieces", () => {
  const outfit: Outfit = {
    id: 9,
    user_id: 1,
    name: "City Layers",
    tags: ["autumn"],
    notes: "For museum afternoons",
    item_ids: [1],
    items: [makeItem({ id: 1, name: "Indigo Denim Skirt", tags: ["blue"] })],
  };

  assert.equal(matchesOutfitSearchQuery(outfit, "museum denim"), true);
  assert.equal(matchesOutfitSearchQuery(outfit, "museum beach"), false);
});

test("outfit suggestions use the same matching behavior and explain matching pieces", () => {
  const goldItem = makeItem({
    id: 1,
    name: "Metallic Camisole",
    tags: ["party"],
    style_notes: "Champagne gold sequins",
  });
  const outfits: Outfit[] = [{
    id: 9,
    user_id: 1,
    name: "Night Out",
    tags: ["evening"],
    notes: "",
    item_ids: [1],
    items: [goldItem],
  }];

  assert.deepEqual(getOutfitSearchSuggestions(outfits, "gold"), outfits);
  assert.equal(
    formatOutfitSearchSuggestionDetail(outfits[0], "gold"),
    "Metallic Camisole · 1 piece",
  );
});

test("getClosetSearchSuggestions returns empty list for blank query", () => {
  const items = [makeItem({ id: 1, name: "Denim Jacket", tags: ["denim"] })];

  assert.deepEqual(
    getClosetSearchSuggestions(items, "   ", [], [], [], "name-asc"),
    [],
  );
});

test("getClosetSearchSuggestions respects active filters", () => {
  const items = [
    makeItem({ id: 1, name: "Blue Tee", brand: "Nike", tags: ["blue", "cotton"] }),
    makeItem({ id: 2, name: "Red Tee", brand: "Adidas", tags: ["red", "cotton"] }),
  ];

  const suggestions = getClosetSearchSuggestions(
    items,
    "tee",
    ["Nike"],
    [],
    [],
    "name-asc",
    { limit: 8 },
  );

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0]?.id, 1);
});

test("getClosetSearchSuggestions limits results", () => {
  const items = Array.from({ length: 12 }, (_, index) =>
    makeItem({ id: index + 1, name: `Item ${index + 1}`, tags: ["shared"] }),
  );

  const suggestions = getClosetSearchSuggestions(
    items,
    "item",
    [],
    [],
    [],
    "name-asc",
    { limit: 3 },
  );

  assert.equal(suggestions.length, 3);
});
