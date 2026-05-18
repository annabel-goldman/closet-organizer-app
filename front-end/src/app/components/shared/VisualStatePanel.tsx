import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { PrimitiveText } from "../primitives/PrimitiveText";

interface VisualStatePanelProps {
  overline: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone?: "default" | "destructive";
  children?: React.ReactNode;
}

export function VisualStatePanel({
  overline,
  title,
  description,
  icon: Icon,
  tone = "default",
  children,
}: VisualStatePanelProps) {
  const isDestructive = tone === "destructive";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className={`overflow-hidden border bg-card ${
        isDestructive ? "border-destructive/25" : "border-border"
      }`}
    >
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div
          className={`flex min-h-[10rem] items-center justify-center ${
            isDestructive ? "bg-destructive/5" : "bg-muted/40"
          }`}
        >
          <Icon
            className={`h-16 w-16 ${isDestructive ? "text-destructive/70" : "text-muted-foreground"}`}
            strokeWidth={1.25}
            aria-hidden
          />
        </div>

        <div className={`p-8 md:p-10 ${isDestructive ? "bg-destructive/5" : ""}`}>
          <PrimitiveText
            as="p"
            variant="overline"
            tone={isDestructive ? "destructiveSoft" : "muted"}
            className="mb-3"
          >
            {overline}
          </PrimitiveText>
          <PrimitiveText as="h1" variant="display" font="serif" className="mb-3">
            {title}
          </PrimitiveText>
          <PrimitiveText as="p" tone="muted" className="mb-6 max-w-prose">
            {description}
          </PrimitiveText>
          {children ? <div className="flex flex-wrap gap-3">{children}</div> : null}
        </div>
      </div>
    </motion.div>
  );
}
