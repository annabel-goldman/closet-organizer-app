import assert from "node:assert/strict";
import test from "node:test";

import {
  generateOutfit,
  mergeMetadataSuggestion,
  resolveEditableImageFetchUrl,
} from "../src/app/lib/closet.ts";
import { validateClothingItemForm } from "../src/app/lib/itemFormValidation.ts";
import { normalizeCategory } from "../src/app/lib/wardrobeTaxonomy.ts";

test("generateOutfit posts an optional occasion and preserves item visual descriptions", async () => {
  const originalFetch = globalThis.fetch;
  let requestedPath = "";
  let requestInit: RequestInit | undefined;

  globalThis.fetch = async (input, init) => {
    requestedPath = String(input);
    requestInit = init;

    return new Response(
      JSON.stringify({
        id: 44,
        user_id: 1,
        name: "Dinner Look",
        tags: ["dinner"],
        notes: "Built from visual descriptions.",
        item_ids: [7],
        generation_id: 12,
        generated_by_ai: true,
        generated_item_ids: [7],
        items: [
          {
            id: 7,
            name: "Ivory Blouse",
            category: "blouse",
            brand: null,
            style_notes: "Tuck into wide-leg trousers.",
            size: "na",
            date: null,
            user_id: 1,
            tags: ["ivory"],
          },
        ],
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  try {
    const outfit = await generateOutfit("dinner");

    assert.equal(requestedPath, "/api/outfits/generate");
    assert.equal(requestInit?.method, "POST");
    assert.equal(requestInit?.body, JSON.stringify({ occasion: "dinner" }));
    assert.equal(outfit.items[0]?.style_notes, "Tuck into wide-leg trousers.");
    assert.equal(outfit.generation_id, 12);
    assert.equal(outfit.generated_by_ai, true);
    assert.deepEqual(outfit.generated_item_ids, [7]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("generateOutfit posts a reference flatlay photo as multipart form data", async () => {
  const originalFetch = globalThis.fetch;
  let requestInit: RequestInit | undefined;
  const referencePhoto = new File(["flatlay"], "flatlay.png", { type: "image/png" });

  globalThis.fetch = async (_input, init) => {
    requestInit = init;

    return new Response(
      JSON.stringify({
        id: 45,
        user_id: 1,
        name: "Reference Look",
        tags: ["reference"],
        notes: "Matched to the uploaded flatlay.",
        item_ids: [7],
        items: [
          {
            id: 7,
            name: "Ivory Blouse",
            category: "blouse",
            brand: null,
            style_notes: null,
            size: "na",
            date: null,
            user_id: 1,
            tags: ["ivory"],
          },
        ],
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  try {
    await generateOutfit({ occasion: "match this", referencePhoto });

    assert.equal(requestInit?.method, "POST");
    assert.ok(requestInit?.body instanceof FormData);
    const body = requestInit.body;
    assert.equal(body.get("occasion"), "match this");
    assert.equal(body.get("reference_photo"), referencePhoto);
    assert.equal(new Headers(requestInit.headers).has("Content-Type"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("generateOutfit surfaces AI failure stage and cause details", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => new Response(
    JSON.stringify({
      error: "AI outfit generation failed during candidate selection: OpenRouter timed out",
      stage: "candidate_selection",
      provider: "openrouter",
      cause_class: "Net::ReadTimeout",
      cause: "Net::ReadTimeout with \"Net::ReadTimeout\"",
    }),
    {
      status: 422,
      headers: { "Content-Type": "application/json" },
    },
  );

  try {
    await assert.rejects(
      () => generateOutfit("ice bar"),
      {
        message:
          "AI outfit generation failed during candidate selection: OpenRouter timed out (stage: candidate_selection; provider: openrouter; cause: Net::ReadTimeout - Net::ReadTimeout with \"Net::ReadTimeout\")",
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("mergeMetadataSuggestion fills visual descriptions from AI metadata", () => {
  const values = {
    category: "blouse",
    name: "Ivory Blouse",
    brand: "",
    visualDescription: "",
    size: "na",
    date: "",
    tags: "ivory",
  };

  const merged = mergeMetadataSuggestion(values, {
    category: "blouse",
    name: "Ivory Silk Blouse",
    brand: "Maison North",
    style_notes: "Tuck into wide-leg trousers.",
    tags: ["ivory", "silk"],
  });

  assert.equal(merged.visualDescription, "Tuck into wide-leg trousers.");
});

test("mergeMetadataSuggestion normalizes category aliases to canonical item types", () => {
  const values = {
    category: "top",
    name: "Ivory Blouse",
    brand: "",
    visualDescription: "",
    size: "na",
    date: "",
    tags: "ivory",
  };

  const merged = mergeMetadataSuggestion(values, {
    category: "tote",
    name: "Canvas Tote",
    brand: "",
    tags: ["canvas"],
  });

  assert.equal(merged.category, "bag");
});

test("validateClothingItemForm requires a canonical item type", () => {
  const baseValues = {
    category: "blouse",
    name: "Ivory Blouse",
    brand: "",
    visualDescription: "",
    size: "na",
    date: "",
    tags: "ivory",
  };

  assert.equal(validateClothingItemForm(baseValues).category, "Choose one of the available item types.");
  assert.equal(validateClothingItemForm({ ...baseValues, category: "top" }).category, undefined);
  assert.equal(validateClothingItemForm({ ...baseValues, category: "swimwear" }).category, undefined);
  assert.equal(validateClothingItemForm({ ...baseValues, category: "accessory" }).category, undefined);
});

test("normalizeCategory treats swimwear as a canonical item type", () => {
  assert.equal(normalizeCategory("swimwear"), "swimwear");
  assert.equal(normalizeCategory("bikini"), "swimwear");
  assert.equal(normalizeCategory("swimsuit"), "swimwear");
});

test("normalizeCategory treats accessories as a canonical item type", () => {
  assert.equal(normalizeCategory("accessory"), "accessory");
  assert.equal(normalizeCategory("scarf"), "accessory");
  assert.equal(normalizeCategory("belt"), "accessory");
  assert.equal(normalizeCategory("handbag"), "bag");
});

test("resolveEditableImageFetchUrl keeps local Active Storage fetches same-origin and proxied", () => {
  const globalScope = globalThis as typeof globalThis & {
    window?: { location: { hostname: string; origin: string; port: string } };
  };
  const originalWindow = globalScope.window;
  globalScope.window = {
    location: {
      hostname: "localhost",
      origin: "http://localhost:5173",
      port: "5173",
    },
  };

  try {
    assert.equal(
      resolveEditableImageFetchUrl(
        "http://localhost:3000/rails/active_storage/blobs/redirect/token/red-shirt.png",
      ),
      "/rails/active_storage/blobs/proxy/token/red-shirt.png",
    );
    assert.equal(
      resolveEditableImageFetchUrl(
        "http://127.0.0.1:3000/rails/active_storage/blobs/redirect/token/red-shirt.png?disposition=inline",
      ),
      "/rails/active_storage/blobs/proxy/token/red-shirt.png?disposition=inline",
    );
    assert.equal(
      resolveEditableImageFetchUrl(
        "/rails/active_storage/representations/redirect/signed/variation/red-shirt.png",
      ),
      "/rails/active_storage/representations/proxy/signed/variation/red-shirt.png",
    );
  } finally {
    if (originalWindow) {
      globalScope.window = originalWindow;
    } else {
      delete globalScope.window;
    }
  }
});
