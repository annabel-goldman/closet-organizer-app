import assert from "node:assert/strict";
import test from "node:test";

import type { AiWorkflow } from "../src/app/lib/closet.ts";
import {
  resolveOutfitGalleryModelPreview,
  resolveModeledWorkflowImageUrl,
  resolveOutfitPreviewSlideAfterSwipe,
} from "../src/app/lib/modeledPreview.ts";

function workflowWithArtifacts(fileUrls: Array<string | null>): AiWorkflow {
  return {
    id: 41,
    kind: "modeled_outfit",
    status: "review",
    completed_count: 1,
    failed_count: 0,
    stages: [
      {
        key: "modeled",
        status: "review",
        artifacts: fileUrls.map((fileUrl, index) => ({
          id: index + 1,
          kind: "modeled_outfit",
          status: "review",
          file_url: fileUrl,
        })),
      },
    ],
  };
}

test("modeled outfit preview uses the latest available artifact image", () => {
  const workflow = workflowWithArtifacts([null, "/modeled/first.png", "/modeled/latest.png"]);

  assert.equal(resolveModeledWorkflowImageUrl(workflow), "/modeled/latest.png");
  assert.equal(resolveModeledWorkflowImageUrl(null), null);
});

test("outfit gallery model view uses an image when available and a placeholder otherwise", () => {
  const workflow = workflowWithArtifacts(["/modeled/gallery.png"]);

  assert.deepEqual(resolveOutfitGalleryModelPreview(workflow), {
    kind: "image",
    imageUrl: "/modeled/gallery.png",
  });
  assert.deepEqual(resolveOutfitGalleryModelPreview(null), {
    kind: "placeholder",
    imageUrl: null,
  });
});

test("modeled outfit preview upgrades Active Storage redirects to proxy URLs", () => {
  const workflow = workflowWithArtifacts([
    "http://localhost:3000/rails/active_storage/blobs/redirect/token/modeled.png",
  ]);

  assert.equal(
    resolveModeledWorkflowImageUrl(workflow),
    "http://localhost:3000/rails/active_storage/blobs/proxy/token/modeled.png",
  );
});

test("rejected modeled artifacts are removed from the outfit carousel", () => {
  const workflow = workflowWithArtifacts(["/modeled/rejected.png"]);
  workflow.status = "rejected";
  workflow.stages[0]!.status = "rejected";
  workflow.stages[0]!.artifacts![0]!.status = "rejected";

  assert.equal(resolveModeledWorkflowImageUrl(workflow), null);
});

test("deleted modeled artifacts are removed from the outfit carousel", () => {
  const workflow = workflowWithArtifacts(["/modeled/deleted.png"]);
  workflow.status = "deleted";
  workflow.stages[0]!.artifacts![0]!.status = "deleted";

  assert.equal(resolveModeledWorkflowImageUrl(workflow), null);
});

test("horizontal swipes move between flat lay and modeled outfit slides", () => {
  assert.equal(
    resolveOutfitPreviewSlideAfterSwipe({
      currentSlide: "flatlay",
      deltaX: -80,
      deltaY: 8,
      hasModeledImage: true,
    }),
    "modeled",
  );
  assert.equal(
    resolveOutfitPreviewSlideAfterSwipe({
      currentSlide: "modeled",
      deltaX: 80,
      deltaY: 8,
      hasModeledImage: true,
    }),
    "flatlay",
  );
});

test("vertical, short, and unavailable modeled-preview swipes keep the current slide", () => {
  assert.equal(
    resolveOutfitPreviewSlideAfterSwipe({
      currentSlide: "flatlay",
      deltaX: -30,
      deltaY: 4,
      hasModeledImage: true,
    }),
    "flatlay",
  );
  assert.equal(
    resolveOutfitPreviewSlideAfterSwipe({
      currentSlide: "flatlay",
      deltaX: -80,
      deltaY: 120,
      hasModeledImage: true,
    }),
    "flatlay",
  );
  assert.equal(
    resolveOutfitPreviewSlideAfterSwipe({
      currentSlide: "flatlay",
      deltaX: -80,
      deltaY: 0,
      hasModeledImage: false,
    }),
    "flatlay",
  );
});
