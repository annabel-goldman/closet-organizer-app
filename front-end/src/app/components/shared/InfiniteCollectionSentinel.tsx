import { RefObject } from "react";
import { PrimitiveText } from "../primitives/PrimitiveText";

interface InfiniteCollectionSentinelProps {
  hasMore: boolean;
  label: string;
  sentinelRef: RefObject<HTMLDivElement | null>;
}

export function InfiniteCollectionSentinel({
  hasMore,
  label,
  sentinelRef,
}: InfiniteCollectionSentinelProps) {
  return (
    <div
      ref={sentinelRef}
      className="flex min-h-8 items-center justify-center py-2"
      aria-live="polite"
    >
      {hasMore ? (
        <PrimitiveText as="span" variant="caption" tone="muted">
          {label}
        </PrimitiveText>
      ) : null}
    </div>
  );
}
