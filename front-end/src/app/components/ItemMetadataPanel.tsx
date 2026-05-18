import { ReactNode } from "react";
import { formatTagLabel } from "../lib/closet";
import { PrimitiveText } from "./primitives/PrimitiveText";

interface ItemMetadataPanelProps {
  action?: ReactNode;
  category?: string | null;
  children: ReactNode;
  title: string;
}

export function ItemMetadataPanel({
  action,
  category,
  children,
  title,
}: ItemMetadataPanelProps) {
  const categoryLabel = category?.trim() ? formatTagLabel(category) : "Type Not Set";

  return (
    <div className="border border-border bg-card p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <PrimitiveText as="p" variant="overline" tone="muted" className="mb-2">
            {categoryLabel}
          </PrimitiveText>
          <PrimitiveText as="h2" variant="title" font="serif" className="mb-1">
            {title}
          </PrimitiveText>
        </div>

        {action}
      </div>

      {children}
    </div>
  );
}
