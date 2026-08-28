import type { AiWorkflow } from "./closet";

export interface GenerationTask {
  label: string;
  workflow: AiWorkflow;
  isCancelling?: boolean;
  cancelError?: string;
}

export function isGenerationTaskRunning(task: GenerationTask) {
  return ["pending", "processing"].includes(task.workflow.status);
}

export function generationTaskLabel(task: GenerationTask) {
  const resultName = task.workflow.metadata?.result_name;
  return typeof resultName === "string" && resultName.trim() ? resultName : task.label;
}

export function generationTaskMessage(task: GenerationTask) {
  const running = isGenerationTaskRunning(task);
  const completed = ["review", "succeeded"].includes(task.workflow.status);

  switch (task.workflow.kind) {
    case "item_clean":
      return running ? "Cleaning the image for" : completed ? "Cleaned the image for" : "Image cleaning updated for";
    case "outfit_generation":
      return running ? "Generating" : completed ? "Generated" : "Outfit generation updated for";
    case "outfit_upload":
      return running ? "Detecting items in" : completed ? "Detected items in" : "Item detection updated for";
    case "modeled_item":
    case "modeled_outfit":
      return running ? "Generating a modeled preview for" : completed ? "Generated a modeled preview for" : "Modeled preview updated for";
    default:
      return running ? "Generating" : completed ? "Generated" : "Generation updated for";
  }
}
