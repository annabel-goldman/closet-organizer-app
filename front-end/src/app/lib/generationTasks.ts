import type { AiWorkflow } from "./closet";

export interface GenerationTask {
  label: string;
  workflow: AiWorkflow;
  isCancelling?: boolean;
  cancelError?: string;
  isDismissed?: boolean;
}

export function isGenerationTaskRunning(task: GenerationTask) {
  return ["pending", "processing"].includes(task.workflow.status);
}

export function isGenerationTaskSuccessful(task: GenerationTask) {
  return ["review", "succeeded"].includes(task.workflow.status);
}

export function generationTaskLabel(task: GenerationTask) {
  const resultName = task.workflow.metadata?.result_name;
  return typeof resultName === "string" && resultName.trim() ? resultName : task.label;
}

export function generationTaskMessage(task: GenerationTask) {
  const running = isGenerationTaskRunning(task);
  const completed = isGenerationTaskSuccessful(task);

  switch (task.workflow.kind) {
    case "item_clean":
      return running ? "Cleaning the image for" : completed ? "Cleaned the image for" : "Image cleaning updated for";
    case "outfit_upload":
      return running ? "Detecting items in" : completed ? "Detected items in" : "Item detection updated for";
    case "modeled_item":
    case "modeled_outfit":
      return running ? "Generating a modeled preview for" : completed ? "Generated a modeled preview for" : "Modeled preview updated for";
    case "wardrobe_index":
      return running ? "Analyzing items in" : completed ? "Finished analyzing" : "Closet analysis updated for";
    case "outfit_recommendation": {
      if (!running) return completed ? "Finished styling" : "Outfit creation updated for";
      const activeStage = task.workflow.stages.find((stage) => stage.status === "processing")?.key;
      if (activeStage === "plan") return "Planning";
      if (activeStage === "retrieve") return "Finding pieces for";
      if (activeStage === "judge") return "Checking compatibility for";
      if (activeStage === "finalize") return "Finalizing";
      return "Preparing";
    }
    default:
      return running ? "Generating" : completed ? "Generated" : "Generation updated for";
  }
}
