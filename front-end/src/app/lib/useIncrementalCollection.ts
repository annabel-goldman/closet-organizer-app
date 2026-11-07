import { useEffect, useMemo, useRef, useState } from "react";

interface IncrementalCollectionOptions {
  batchSize?: number;
  preloadDistance?: number;
  resetKey?: string;
  rootMargin?: string;
}

export function useIncrementalCollection<Item>(
  items: Item[],
  {
    batchSize = 48,
    preloadDistance = 800,
    resetKey = "",
    rootMargin = "800px 0px",
  }: IncrementalCollectionOptions = {},
) {
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const loadMorePendingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadMorePendingRef.current = false;
    setVisibleCount(batchSize);
  }, [batchSize, resetKey]);

  useEffect(() => {
    loadMorePendingRef.current = false;
  }, [visibleCount]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || visibleCount >= items.length) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisibleCount(items.length);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      if (loadMorePendingRef.current) return;

      loadMorePendingRef.current = true;
      setVisibleCount((current) => Math.min(current + batchSize, items.length));
    }, { rootMargin });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [batchSize, items.length, rootMargin, visibleCount]);

  useEffect(() => {
    if (visibleCount >= items.length) return;

    const loadMoreNearViewport = () => {
      const sentinel = sentinelRef.current;
      if (!sentinel) return;

      const sentinelTop = sentinel.getBoundingClientRect().top;
      if (sentinelTop > window.innerHeight + preloadDistance) return;
      if (loadMorePendingRef.current) return;

      loadMorePendingRef.current = true;
      setVisibleCount((current) => Math.min(current + batchSize, items.length));
    };

    window.addEventListener("scroll", loadMoreNearViewport, { passive: true });
    window.addEventListener("resize", loadMoreNearViewport);
    return () => {
      window.removeEventListener("scroll", loadMoreNearViewport);
      window.removeEventListener("resize", loadMoreNearViewport);
    };
  }, [batchSize, items.length, preloadDistance, visibleCount]);

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
