import assert from "node:assert/strict";
import test from "node:test";

import type { ClothingItem, Outfit, OutfitFolder } from "../src/app/lib/closet.ts";
import {
  formatMagazineSearchSuggestionDetail,
  formatOutfitSearchSuggestionDetail,
  filterClothingItems,
  getClosetSearchSuggestions,
  getMagazineSearchSuggestions,
  getOutfitSearchSuggestions,
  matchesMagazineSearchQuery,
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

test("termMatchesInHaystack ignores reverse matches against short filler words", () => {
  assert.equal(termMatchesInHaystack("black", "red dress a flowing evening silhouette"), false);
  assert.equal(termMatchesInHaystack("coat", "red dress a flowing evening silhouette"), false);
});

test("termMatchesInHaystack normalizes punctuation and accents", () => {
  assert.equal(termMatchesInHaystack("cafe", "Café-ready jacket"), true);
  assert.equal(termMatchesInHaystack("t shirt", "striped T-shirt"), true);
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

test("magazine search includes its metadata and contained outfits", () => {
  const outfit: Outfit = {
    id: 9,
    user_id: 1,
    name: "Gallery Opening",
    tags: ["evening"],
    notes: "For museum nights",
    item_ids: [1],
    items: [makeItem({ id: 1, name: "Silk Midi Dress", tags: ["black"] })],
  };
  const magazine: OutfitFolder = {
    id: 4,
    user_id: 1,
    name: "Autumn in New York",
    occasion: "City weekends",
    notes: "Layered seasonal looks",
    page_layouts: {},
    outfit_ids: [outfit.id],
    outfits: [outfit],
    decorations: [],
  };

  assert.equal(matchesMagazineSearchQuery(magazine, "autumn city"), true);
  assert.equal(matchesMagazineSearchQuery(magazine, "museum silk"), true);
  assert.deepEqual(getMagazineSearchSuggestions([magazine], "silk"), [magazine]);
  assert.equal(formatMagazineSearchSuggestionDetail(magazine), "1 outfit · City weekends");
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

test("closet search ranks direct name matches ahead of tag and description matches", () => {
  const items = [
    makeItem({ id: 1, name: "Evening Dress", style_notes: "Black satin with a fitted waist" }),
    makeItem({ id: 2, name: "Black Coat", style_notes: "Long wool outerwear" }),
    makeItem({ id: 3, name: "Dark Jacket", tags: ["black"] }),
  ];

  const results = filterClothingItems(items, "black", [], [], [], "name-asc");

  assert.deepEqual(results.map((item) => item.id), [2, 3, 1]);
});

test("filterClothingItems filters by canonical wardrobe type", () => {
  const items = [
    makeItem({ id: 1, name: "Blue Tee", category: "top", tags: ["blue"] }),
    makeItem({ id: 2, name: "Gold Earrings", category: "accessory", tags: ["gold"] }),
    makeItem({ id: 3, name: "Black Skirt", category: "bottom", tags: ["black"] }),
  ];

  const filteredItems = filterClothingItems(
    items,
    "",
    [],
    [],
    ["accessory"],
    "name-asc",
  );

  assert.deepEqual(filteredItems.map((item) => item.id), [2]);
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
