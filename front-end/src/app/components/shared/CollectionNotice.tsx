import type { ReactNode } from "react";

import { cn } from "../ui/utils";
import { PrimitiveText } from "../primitives/PrimitiveText";

interface CollectionNoticeProps {
  children: ReactNode;
  className?: string;
  tone?: "default" | "destructive" | "success";
}
export function CollectionNotice({ children, className, tone = "default" }: CollectionNoticeProps) {
  return (
    <div
      className={cn(
        "border px-4 py-3",
        tone === "default" && "border-border bg-card",
        tone === "destructive" && "border-destructive/25 bg-destructive/5 text-destructive",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-950",
        className,
      )}
      role={tone === "destructive" ? "alert" : "status"}
    >
      <PrimitiveText as="div" variant="bodySm" tone={tone === "destructive" ? "destructive" : "default"}>
        {children}
      </PrimitiveText>
    </div>
  );
}
