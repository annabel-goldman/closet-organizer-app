import { requestJson } from "../api.ts";
import { API_BASE_URL } from "../apiConfig.ts";
import { normalizeAttachmentUrl } from "../imageSources.ts";
import type { AiStatus, AiWorkflow } from "../types/ai.ts";

export function normalizeAiWorkflowPayload(workflow: AiWorkflow): AiWorkflow {
  return {
    ...workflow,
    stages: (workflow.stages ?? []).map((stage) => ({
      ...stage,
      artifacts: (stage.artifacts ?? []).map((artifact) => ({
        ...artifact,
        file_url: normalizeAttachmentUrl(artifact.file_url),
      })),
    })),
  };
}

export async function fetchAiStatus(signal?: AbortSignal) {
  return requestJson<AiStatus>(`${API_BASE_URL}/ai/status`, { signal });
}

export async function createAiWorkflow(input: {
  kind: AiWorkflow["kind"];
  requestedCount?: number;
  promptVersion?: string;
  metadata?: Record<string, unknown>;
}) {
  return requestJson<AiWorkflow>(`${API_BASE_URL}/ai_workflows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ai_workflow: {
        kind: input.kind,
        requested_count: input.requestedCount,
        prompt_version: input.promptVersion,
        metadata: input.metadata,
      },
    }),
  }).then(normalizeAiWorkflowPayload);
}

export async function fetchAiWorkflow(id: number, signal?: AbortSignal) {
  return requestJson<AiWorkflow>(`${API_BASE_URL}/ai_workflows/${id}`, { signal })
    .then(normalizeAiWorkflowPayload);
}

export async function cancelAiWorkflow(id: number) {
  return requestJson<AiWorkflow>(`${API_BASE_URL}/ai_workflows/${id}/cancel`, {
    method: "POST",
  }).then(normalizeAiWorkflowPayload);
}

export async function deleteModeledPreview(workflowId: number) {
  return requestJson<AiWorkflow>(`${API_BASE_URL}/ai_workflows/${workflowId}/preview`, {
    method: "DELETE",
  }).then(normalizeAiWorkflowPayload);
}

export async function updateModeledPreview(workflowId: number, photo: File) {
  const formData = new FormData();
  formData.append("modeled_preview[photo]", photo);

  return requestJson<AiWorkflow>(`${API_BASE_URL}/ai_workflows/${workflowId}/preview`, {
    method: "PATCH",
    body: formData,
  }).then(normalizeAiWorkflowPayload);
}

export async function requestModeledImage(itemId: number) {
  return requestJson<AiWorkflow>(`${API_BASE_URL}/clothing_items/${itemId}/generate_modeled_image`, {
    method: "POST",
  }).then(normalizeAiWorkflowPayload);
}
