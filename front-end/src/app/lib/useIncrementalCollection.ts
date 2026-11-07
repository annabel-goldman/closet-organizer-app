import { useEffect, useMemo, useRef, useState } from "react";

interface IncrementalCollectionOptions {
  batchSize?: number;
  resetKey?: string;
  rootMargin?: string;
}

export function useIncrementalCollection<Item>(
  items: Item[],
  {
    batchSize = 48,
    resetKey = "",
    rootMargin = "800px 0px",
  }: IncrementalCollectionOptions = {},
) {
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(batchSize);
  }, [batchSize, resetKey]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || visibleCount >= items.length) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisibleCount(items.length);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;

      setVisibleCount((current) => Math.min(current + batchSize, items.length));
    }, { rootMargin });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [batchSize, items.length, rootMargin, visibleCount]);

  const cappedVisibleCount = Math.min(visibleCount, items.length);

  return {
    hasMore: cappedVisibleCount < items.length,
    sentinelRef,
    visibleCount: cappedVisibleCount,
    visibleItems: useMemo(
      () => items.slice(0, cappedVisibleCount),
      [cappedVisibleCount, items],
    ),
  };
}
