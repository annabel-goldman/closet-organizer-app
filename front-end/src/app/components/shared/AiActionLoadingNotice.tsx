import { LoaderCircle } from "lucide-react";
import { PrimitiveText } from "../primitives/PrimitiveText";

interface AiActionLoadingNoticeProps {
  message: string;
  className?: string;
}

export function AiActionLoadingNotice({ message, className = "" }: AiActionLoadingNoticeProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`flex items-start gap-3 border border-border/70 bg-muted/35 px-3 py-3 ${className}`}
    >
      <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
      <PrimitiveText as="p" variant="bodySm">
        {message}
      </PrimitiveText>
    </div>
  );
}
