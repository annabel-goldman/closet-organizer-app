import type { ReactNode } from "react";

import { cn } from "../ui/utils";
import { PrimitiveText } from "../primitives/PrimitiveText";

interface CollectionPageShellProps {
  children: ReactNode;
  className?: string;
}

export function CollectionPageShell({ children, className }: CollectionPageShellProps) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-6 py-12", className)}>
      {children}
    </div>
  );
}

interface CollectionPageHeaderProps {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}

export function CollectionPageHeader({
  actions,
  className,
  description,
  eyebrow,
  title,
}: CollectionPageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-8 flex flex-col items-start justify-between gap-6 border-b border-border pb-7 md:flex-row md:items-end",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <PrimitiveText as="p" variant="overline" tone="muted" className="mb-2">
            {eyebrow}
          </PrimitiveText>
        ) : null}
        <PrimitiveText
          as="h1"
          variant="display"
          font="serif"
          className="break-words text-[clamp(2.5rem,5vw,4rem)] leading-none tracking-tight"
        >
          {title}
        </PrimitiveText>
        {description ? (
          <PrimitiveText as="div" tone="muted" className="mt-2 max-w-2xl tracking-wide">
            {description}
          </PrimitiveText>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}

interface CollectionToolbarProps {
  children: ReactNode;
  className?: string;
}

export function CollectionToolbar({ children, className }: CollectionToolbarProps) {
  return <div className={cn("mb-8 space-y-3", className)}>{children}</div>;
}

export type CollectionGridVariant = "wardrobe" | "standard" | "dense";

const gridStyles: Record<CollectionGridVariant, string> = {
  wardrobe: "grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-4",
  standard: "grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3",
  dense: "grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
};

interface CollectionGridProps {
  children: ReactNode;
  className?: string;
  variant?: CollectionGridVariant;
}

export function CollectionGrid({ children, className, variant = "standard" }: CollectionGridProps) {
  return <div className={cn("grid", gridStyles[variant], className)}>{children}</div>;
}

interface CollectionGridSkeletonProps {
  count: number;
  label?: string;
  mediaClassName: string;
  variant?: CollectionGridVariant;
}

export function CollectionGridSkeleton({
  count,
  label = "Loading collection",
  mediaClassName,
  variant = "standard",
}: CollectionGridSkeletonProps) {
  return (
    <div role="status">
      <span className="sr-only">{label}</span>
      <CollectionGrid variant={variant}>
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className={cn(
              "animate-pulse overflow-hidden border border-border bg-card",
              variant === "standard" && "mx-auto w-full max-w-[22rem]",
            )}
          >
            <div className={cn("bg-muted/70", mediaClassName)} />
            <div className="space-y-3 border-t border-border p-5">
              <div className="h-6 w-2/3 bg-muted" />
              <div className="h-4 w-1/2 bg-muted" />
            </div>
          </div>
        ))}
      </CollectionGrid>
    </div>
  );
}
