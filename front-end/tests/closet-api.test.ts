import assert from "node:assert/strict";
import test from "node:test";

import {
  cancelAiWorkflow,
  createOutfitFolder,
  createOutfitFolderDecoration,
  deleteModeledPreview,
  fetchOutfitFolders,
  generateClothingItemCleanImage,
  generateOutfit,
  generateOutfitMetadataSuggestions,
  mergeMetadataSuggestion,
  requestModeledOutfit,
  resolveEditableImageFetchUrl,
  saveModelReferences,
  updateModeledPreview,
  updateOutfitFolderDecoration,
} from "../src/app/lib/closet.ts";
import { validateClothingItemForm } from "../src/app/lib/itemFormValidation.ts";
import { normalizeCategory } from "../src/app/lib/wardrobeTaxonomy.ts";

test("generateOutfit queues a background workflow with an optional occasion", async () => {
  const originalFetch = globalThis.fetch;
  let requestedPath = "";
  let requestInit: RequestInit | undefined;

  globalThis.fetch = async (input, init) => {
    requestedPath = String(input);
    requestInit = init;

    return new Response(
      JSON.stringify({
        id: 44,
        kind: "outfit_generation",
        status: "pending",
        completed_count: 0,
        failed_count: 0,
        metadata: { occasion: "dinner" },
        stages: [],
      }),
      {
        status: 202,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  try {
    const workflow = await generateOutfit("dinner");

    assert.equal(requestedPath, "/api/outfits/generate");
    assert.equal(requestInit?.method, "POST");
    assert.equal(requestInit?.body, JSON.stringify({ occasion: "dinner" }));
    assert.equal(workflow.kind, "outfit_generation");
    assert.equal(workflow.status, "pending");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("outfit folder APIs preserve magazine order and upload page-specific clip art", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ path: string; init?: RequestInit }> = [];
  const folderPayload = {
    id: 8,
    user_id: 1,
    name: "Paris Weekend",
    occasion: "Paris · September",
    notes: "Three days",
    outfit_ids: [19, 12],
    outfits: [],
    decorations: [],
  };

  globalThis.fetch = async (input, init) => {
    requests.push({ path: String(input), init });
    if (String(input).endsWith("/decorations") && init?.method === "POST") {
      return new Response(JSON.stringify({
        id: 31,
        outfit_folder_id: 8,
        page_key: "cover",
        image_url: "/rails/active_storage/blobs/proxy/clip-art",
        x: 12,
        y: 18,
        width: 24,
        rotation: 0,
        layer_order: 0,
      }), { status: 201, headers: { "Content-Type": "application/json" } });
    }
    if (String(input).includes("/decorations/31")) {
      return new Response(JSON.stringify({
        id: 31,
        outfit_folder_id: 8,
        page_key: "cover",
        image_url: "/rails/active_storage/blobs/proxy/clip-art",
        x: 42,
        y: 18,
        width: 24,
        rotation: 0,
        layer_order: 0,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (init?.method === "POST") {
      return new Response(JSON.stringify(folderPayload), { status: 201, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify([folderPayload]), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const folder = await createOutfitFolder({
      name: "Paris Weekend",
      occasion: "Paris · September",
      notes: "Three days",
      outfitIds: [19, 12],
    });
    const folders = await fetchOutfitFolders();
    const clipArt = new File(["clip"], "star.png", { type: "image/png" });
    const decoration = await createOutfitFolderDecoration(folder.id, {
      file: clipArt,
      pageKey: "cover",
      x: 12,
      y: 18,
      width: 24,
    });
    const movedDecoration = await updateOutfitFolderDecoration(folder.id, decoration.id, { x: 42 });

    assert.deepEqual(folder.outfit_ids, [19, 12]);
    assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {
      outfit_folder: {
        name: "Paris Weekend",
        occasion: "Paris · September",
        notes: "Three days",
        outfit_ids: [19, 12],
      },
    });
    assert.ok(requests[2].init?.body instanceof FormData);
    assert.equal((requests[2].init?.body as FormData).get("decoration[image]"), clipArt);
    assert.equal((requests[2].init?.body as FormData).get("decoration[page_key]"), "cover");
    assert.equal(movedDecoration.x, 42);
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
        kind: "outfit_generation",
        status: "pending",
        completed_count: 0,
        failed_count: 0,
        stages: [],
      }),
      {
        status: 202,
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

test("generateOutfit surfaces queue-time validation details", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => new Response(
    JSON.stringify({
      error: "Add closet items before generating an outfit.",
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
        message: "Add closet items before generating an outfit.",
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("generateClothingItemCleanImage queues a cancellable item-clean workflow", async () => {
  const originalFetch = globalThis.fetch;
  let requestedPath = "";
  let requestInit: RequestInit | undefined;

  globalThis.fetch = async (input, init) => {
    requestedPath = String(input);
    requestInit = init;
    return new Response(JSON.stringify({
      id: 51,
      kind: "item_clean",
      status: "pending",
      completed_count: 0,
      failed_count: 0,
      metadata: { item_id: 7, item_name: "Ivory Blouse" },
      stages: [],
    }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const workflow = await generateClothingItemCleanImage(7);

    assert.equal(requestedPath, "/api/clothing_items/7/generate_clean_image");
    assert.equal(requestInit?.method, "POST");
    assert.ok(requestInit?.body instanceof FormData);
    assert.equal(workflow.kind, "item_clean");
    assert.equal(workflow.status, "pending");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("generateOutfitMetadataSuggestions sends the current outfit draft without saving it", async () => {
  const originalFetch = globalThis.fetch;
  let requestedPath = "";
  let requestInit: RequestInit | undefined;

  globalThis.fetch = async (input, init) => {
    requestedPath = String(input);
    requestInit = init;
    return new Response(JSON.stringify({
      name: "Ivory Gallery Afternoon",
      tags: ["ivory", "gallery", "polished"],
      notes: "A polished ivory look for a gallery afternoon.",
      provider: "openrouter",
      model: "openai/gpt-4.1-mini",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const suggestion = await generateOutfitMetadataSuggestions({
      outfitId: 19,
      itemIds: [7, 8],
      name: "Outfit Aug 28",
      notes: "",
      tags: ["casual"],
    });

    assert.equal(requestedPath, "/api/outfits/19/generate_metadata_suggestions");
    assert.equal(requestInit?.method, "POST");
    assert.deepEqual(JSON.parse(String(requestInit?.body)), {
      outfit: {
        item_ids: [7, 8],
        name: "Outfit Aug 28",
        notes: "",
        tags: ["casual"],
      },
    });
    assert.equal(suggestion.name, "Ivory Gallery Afternoon");
    assert.deepEqual(suggestion.tags, ["ivory", "gallery", "polished"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("generateOutfitMetadataSuggestions uses the collection route for an unsaved cart draft", async () => {
  const originalFetch = globalThis.fetch;
  let requestedPath = "";
  let requestInit: RequestInit | undefined;

  globalThis.fetch = async (input, init) => {
    requestedPath = String(input);
    requestInit = init;
    return new Response(JSON.stringify({
      name: "Soft Western Layers",
      tags: ["cream", "floral", "western"],
      notes: "A soft layered look with warm western accents.",
      provider: "openrouter",
      model: "openai/gpt-4.1-mini",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const suggestion = await generateOutfitMetadataSuggestions({
      itemIds: [7, 8],
      name: "",
      notes: "",
      tags: [],
    });

    assert.equal(requestedPath, "/api/outfits/generate_metadata_suggestions");
    assert.equal(requestInit?.method, "POST");
    assert.deepEqual(JSON.parse(String(requestInit?.body)), {
      outfit: {
        item_ids: [7, 8],
        name: "",
        notes: "",
        tags: [],
      },
    });
    assert.equal(suggestion.name, "Soft Western Layers");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requestModeledOutfit snapshots the current unsaved outfit draft", async () => {
  const originalFetch = globalThis.fetch;
  let requestedPath = "";
  let requestInit: RequestInit | undefined;

  globalThis.fetch = async (input, init) => {
    requestedPath = String(input);
    requestInit = init;
    return new Response(JSON.stringify({
      id: 72,
      kind: "modeled_outfit",
      status: "pending",
      completed_count: 0,
      failed_count: 0,
      stages: [],
    }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await requestModeledOutfit(19, {
      itemIds: [7, 12],
      name: "Unsaved gallery look",
      notes: "Use this draft.",
      tags: ["gallery", "evening"],
    });

    assert.equal(requestedPath, "/api/outfits/19/generate_modeled_image");
    assert.equal(requestInit?.method, "POST");
    assert.equal(new Headers(requestInit?.headers).get("Content-Type"), "application/json");
    assert.deepEqual(JSON.parse(String(requestInit?.body)), {
      modeled_outfit: {
        item_ids: [7, 12],
        name: "Unsaved gallery look",
        notes: "Use this draft.",
        tags: ["gallery", "evening"],
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requestModeledOutfit uploads the styled flat-lay snapshot with the draft", async () => {
  const originalFetch = globalThis.fetch;
  let requestInit: RequestInit | undefined;

  globalThis.fetch = async (_input, init) => {
    requestInit = init;
    return new Response(JSON.stringify({
      id: 73,
      kind: "modeled_outfit",
      status: "pending",
      completed_count: 0,
      failed_count: 0,
      stages: [],
    }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const flatlaySnapshot = new File(["flatlay-bytes"], "styled-flatlay.png", { type: "image/png" });
    await requestModeledOutfit(19, {
      itemIds: [7, 12],
      name: "Styled gallery look",
      notes: "Keep the jacket open.",
      tags: ["layered", "evening"],
    }, flatlaySnapshot);

    assert.equal(requestInit?.method, "POST");
    assert.equal(new Headers(requestInit?.headers).get("Content-Type"), null);
    assert.ok(requestInit?.body instanceof FormData);
    const formData = requestInit.body as FormData;
    assert.deepEqual(formData.getAll("modeled_outfit[item_ids][]"), ["7", "12"]);
    assert.deepEqual(formData.getAll("modeled_outfit[tags][]"), ["layered", "evening"]);
    assert.equal(formData.get("modeled_outfit[name]"), "Styled gallery look");
    assert.equal(formData.get("modeled_outfit[notes]"), "Keep the jacket open.");
    assert.equal(formData.get("flatlay_snapshot"), flatlaySnapshot);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("saveModelReferences uploads multiple photos and normalizes their private thumbnail paths", async () => {
  const originalFetch = globalThis.fetch;
  let requestInit: RequestInit | undefined;
  const frontPhoto = new File(["front"], "front.png", { type: "image/png" });
  const sidePhoto = new File(["side"], "side.png", { type: "image/png" });

  globalThis.fetch = async (_input, init) => {
    requestInit = init;
    return new Response(JSON.stringify({
      id: 1,
      username: "alex",
      admin: false,
      clothing_items: [],
      clothing_items_count: 0,
      model_reference_photo_attached: true,
      model_reference_photo_count: 2,
      model_reference_photos: [
        { id: 11, position: 0, photo_url: "/model_reference_images/11/photo" },
        { id: 12, position: 1, photo_url: "/model_reference_images/12/photo" },
      ],
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const user = await saveModelReferences([frontPhoto, sidePhoto]);

    assert.equal(requestInit?.method, "POST");
    assert.ok(requestInit?.body instanceof FormData);
    assert.deepEqual(
      requestInit.body.getAll("model_reference_images[photos][]"),
      [frontPhoto, sidePhoto],
    );
    assert.equal(user.model_reference_photo_count, 2);
    assert.equal(user.model_reference_photos?.[0]?.photo_url, "/api/model_reference_images/11/photo");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("deleteModeledPreview removes an approved generated artifact through its workflow", async () => {
  const originalFetch = globalThis.fetch;
  let requestedPath = "";
  let requestInit: RequestInit | undefined;

  globalThis.fetch = async (input, init) => {
    requestedPath = String(input);
    requestInit = init;
    return new Response(JSON.stringify({
      id: 41,
      kind: "modeled_outfit",
      status: "deleted",
      completed_count: 1,
      failed_count: 0,
      stages: [
        {
          key: "modeled",
          status: "approved",
          artifacts: [
            { id: 9, kind: "modeled_outfit_image", status: "deleted", file_url: null },
          ],
        },
      ],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const workflow = await deleteModeledPreview(41);

    assert.equal(requestedPath, "/api/ai_workflows/41/preview");
    assert.equal(requestInit?.method, "DELETE");
    assert.equal(workflow.status, "deleted");
    assert.equal(workflow.stages[0]?.artifacts?.[0]?.file_url, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("updateModeledPreview uploads an edited image without setting a multipart content type", async () => {
  const originalFetch = globalThis.fetch;
  let requestedPath = "";
  let requestInit: RequestInit | undefined;
  const editedPhoto = new File(["edited"], "modeled-preview-wand.png", { type: "image/png" });

  globalThis.fetch = async (input, init) => {
    requestedPath = String(input);
    requestInit = init;
    return new Response(JSON.stringify({
      id: 41,
      kind: "modeled_outfit",
      status: "succeeded",
      completed_count: 1,
      failed_count: 0,
      stages: [
        {
          key: "modeled",
          status: "approved",
          artifacts: [
            {
              id: 9,
              kind: "modeled_outfit_image",
              status: "approved",
              file_url: "/rails/active_storage/blobs/proxy/new-token/modeled-preview-wand.png",
            },
          ],
        },
      ],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const workflow = await updateModeledPreview(41, editedPhoto);

    assert.equal(requestedPath, "/api/ai_workflows/41/preview");
    assert.equal(requestInit?.method, "PATCH");
    assert.ok(requestInit?.body instanceof FormData);
    assert.equal(requestInit.body.get("modeled_preview[photo]"), editedPhoto);
    assert.equal(new Headers(requestInit.headers).has("Content-Type"), false);
    assert.match(workflow.stages[0]?.artifacts?.[0]?.file_url ?? "", /\/proxy\//);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cancelAiWorkflow returns the complete cancelled workflow payload", async () => {
  const originalFetch = globalThis.fetch;
  let requestedPath = "";

  globalThis.fetch = async (input) => {
    requestedPath = String(input);
    return new Response(JSON.stringify({
      id: 42,
      kind: "modeled_outfit",
      status: "cancelled",
      completed_count: 0,
      failed_count: 0,
      stages: [
        {
          key: "modeled",
          status: "cancelled",
          artifacts: [
            {
              id: 10,
              kind: "modeled_outfit_image",
              status: "cancelled",
              file_url: "/rails/active_storage/blobs/redirect/token/preview.png",
            },
          ],
        },
      ],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const workflow = await cancelAiWorkflow(42);

    assert.equal(requestedPath, "/api/ai_workflows/42/cancel");
    assert.equal(workflow.status, "cancelled");
    assert.equal(workflow.stages[0]?.status, "cancelled");
    assert.equal(
      workflow.stages[0]?.artifacts?.[0]?.file_url,
      "/rails/active_storage/blobs/redirect/token/preview.png",
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

  assert.equal(merged.category, "accessory");
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
  assert.equal(normalizeCategory("handbag"), "accessory");
  assert.equal(normalizeCategory("bag"), "accessory");
  assert.equal(normalizeCategory("tote"), "accessory");
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
