export type AiWorkflowStageStatus =
  | "pending"
  | "processing"
  | "review"
  | "approved"
  | "rejected"
  | "cancelled"
  | "failed"
  | "skipped";

export interface AiArtifact {
  id: number;
  kind: string;
  status: "pending" | "processing" | "review" | "approved" | "rejected" | "cancelled" | "deleted" | "failed";
  file_url?: string | null;
  provider?: string | null;
  model?: string | null;
  prompt_version?: string | null;
  diagnostics?: Record<string, unknown>;
  error_message?: string | null;
}

export interface AiWorkflowStage {
  id?: number;
  key: string;
  status: AiWorkflowStageStatus;
  decision?: "approve" | "reject" | null;
  attempts?: number;
  diagnostics?: Record<string, unknown>;
  error_message?: string | null;
  artifact_ids?: number[];
  artifacts?: AiArtifact[];
}

export interface AiWorkflow {
  id: number;
  kind: string;
  status: "pending" | "processing" | "review" | "succeeded" | "rejected" | "deleted" | "failed" | "cancelled";
  requested_count?: number | null;
  completed_count: number;
  failed_count: number;
  provider?: string | null;
  model?: string | null;
  prompt_version?: string | null;
  metadata?: Record<string, unknown>;
  error_message?: string | null;
  stages: AiWorkflowStage[];
}

export interface AiStatus {
  provider: string;
  configured: boolean;
  model: string;
  model_reference: {
    attached: boolean;
    count: number;
    consented: boolean;
  };
  image_processing: {
    image_processing_gem: boolean;
    mini_magick: boolean;
    vips: boolean;
  };
  queue_adapter: string;
}
