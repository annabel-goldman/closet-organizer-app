import assert from "node:assert/strict";
import test from "node:test";

import {
  generationTaskLabel,
  generationTaskMessage,
  isGenerationTaskRunning,
  isGenerationTaskSuccessful,
  type GenerationTask,
} from "../src/app/lib/generationTasks.ts";

function task(kind: string, status: GenerationTask["workflow"]["status"]): GenerationTask {
  return {
    label: "Gallery look",
    workflow: {
      id: 1,
      kind,
      status,
      completed_count: status === "succeeded" ? 1 : 0,
      failed_count: 0,
      stages: [],
    },
  };
}

test("generation task copy reflects each durable workflow kind", () => {
  assert.equal(generationTaskMessage(task("modeled_item", "processing")), "Generating a modeled preview for");
  assert.equal(generationTaskMessage(task("item_clean", "processing")), "Cleaning the image for");
  assert.equal(generationTaskMessage(task("outfit_generation", "succeeded")), "Generated");
  assert.equal(generationTaskMessage(task("outfit_upload", "review")), "Detected items in");
});

test("generation tasks remain cancellable only while pending or processing", () => {
  assert.equal(isGenerationTaskRunning(task("item_clean", "pending")), true);
  assert.equal(isGenerationTaskRunning(task("item_clean", "processing")), true);
  assert.equal(isGenerationTaskRunning(task("item_clean", "succeeded")), false);
  assert.equal(isGenerationTaskRunning(task("item_clean", "cancelled")), false);
});

test("generation tasks identify review and succeeded as successful completion", () => {
  assert.equal(isGenerationTaskSuccessful(task("modeled_outfit", "review")), true);
  assert.equal(isGenerationTaskSuccessful(task("modeled_outfit", "succeeded")), true);
  assert.equal(isGenerationTaskSuccessful(task("modeled_outfit", "processing")), false);
  assert.equal(isGenerationTaskSuccessful(task("modeled_outfit", "failed")), false);
});

test("completed outfit generation uses the generated outfit name", () => {
  const completed = task("outfit_generation", "succeeded");
  completed.workflow.metadata = { result_name: "Dinner at Eight" };

  assert.equal(generationTaskLabel(completed), "Dinner at Eight");
});
