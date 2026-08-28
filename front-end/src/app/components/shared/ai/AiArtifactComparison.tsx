import type { ReactNode } from "react";
import { PrimitiveText } from "../../primitives/PrimitiveText";

interface AiArtifactComparisonProps {
  before?: ReactNode;
  after?: ReactNode;
  beforeLabel?: string;
  afterLabel?: string;
}

export function AiArtifactComparison({
  before,
  after,
  beforeLabel = "Source crop",
  afterLabel = "AI preview",
}: AiArtifactComparisonProps) {
  const panels = [
    { content: before, label: beforeLabel },
    { content: after, label: afterLabel },
  ].filter((panel) => panel.content);

  if (panels.length === 0) {
    return null;
  }

  return (
    <div className={`grid gap-3 ${panels.length > 1 ? "sm:grid-cols-2" : ""}`}>
      {panels.map((panel) => (
        <figure className="space-y-2" key={panel.label}>
          <div className="overflow-hidden border border-border bg-muted">
            {panel.content}
          </div>
          <figcaption>
            <PrimitiveText as="p" variant="caption" tone="muted">
              {panel.label}
            </PrimitiveText>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
