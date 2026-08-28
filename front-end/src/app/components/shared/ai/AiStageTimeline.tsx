import { Check, Circle, LoaderCircle, RotateCcw, X } from "lucide-react";
import { PrimitiveText } from "../../primitives/PrimitiveText";

export type AiStageStatus =
  | "pending"
  | "processing"
  | "review"
  | "approved"
  | "rejected"
  | "failed"
  | "skipped";

export interface AiStageTimelineItem {
  key: string;
  label: string;
  status: AiStageStatus;
  detail?: string;
}

interface AiStageTimelineProps {
  stages: AiStageTimelineItem[];
}

const statusCopy: Record<AiStageStatus, string> = {
  pending: "Waiting",
  processing: "Working",
  review: "Review",
  approved: "Approved",
  rejected: "Rejected",
  failed: "Needs attention",
  skipped: "Skipped",
};

function StatusIcon({ status }: { status: AiStageStatus }) {
  if (status === "processing") {
    return <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />;
  }

  if (status === "approved") {
    return <Check className="h-3.5 w-3.5" aria-hidden />;
  }

  if (status === "rejected" || status === "failed") {
    return <X className="h-3.5 w-3.5" aria-hidden />;
  }

  if (status === "review") {
    return <RotateCcw className="h-3.5 w-3.5" aria-hidden />;
  }

  return <Circle className="h-3.5 w-3.5" aria-hidden />;
}

function statusClassName(status: AiStageStatus) {
  switch (status) {
    case "approved":
      return "border-foreground bg-foreground text-background";
    case "processing":
      return "border-foreground bg-background text-foreground";
    case "review":
      return "border-foreground/60 bg-muted text-foreground";
    case "rejected":
    case "failed":
      return "border-destructive/40 bg-destructive/5 text-destructive";
    case "skipped":
      return "border-border bg-muted/40 text-muted-foreground";
    default:
      return "border-border bg-background text-muted-foreground";
  }
}

export function AiStageTimeline({ stages }: AiStageTimelineProps) {
  return (
    <div className="border-t border-border pt-3" aria-label="AI workflow stages">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {stages.map((stage) => (
          <div className="flex items-center gap-2" key={stage.key}>
            <span
              className={`inline-flex h-6 w-6 items-center justify-center border ${statusClassName(stage.status)}`}
              title={`${stage.label}: ${statusCopy[stage.status]}`}
              aria-hidden
            >
              <StatusIcon status={stage.status} />
            </span>
            <div>
              <PrimitiveText as="p" variant="caption" weight="medium">
                {stage.label}
              </PrimitiveText>
              <PrimitiveText as="p" variant="caption" tone="muted">
                {stage.detail || statusCopy[stage.status]}
              </PrimitiveText>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
