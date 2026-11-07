import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIncrementalCollection } from "../../src/app/lib/useIncrementalCollection";

let latestObserverCallback: IntersectionObserverCallback | null = null;

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly scrollMargin = "";
  readonly thresholds = [0];

  constructor(callback: IntersectionObserverCallback) {
    latestObserverCallback = callback;
  }

  disconnect() {}
  observe() {}
  takeRecords() { return []; }
  unobserve() {}
}

function CollectionHarness({ items, resetKey }: { items: number[]; resetKey: string }) {
  const collection = useIncrementalCollection(items, { batchSize: 2, resetKey });

  return (
    <>
      <ul>{collection.visibleItems.map((item) => <li key={item}>{item}</li>)}</ul>
      <div data-testid="collection-sentinel" ref={collection.sentinelRef} />
    </>
  );
}

afterEach(() => {
  cleanup();
  latestObserverCallback = null;
  vi.unstubAllGlobals();
});

describe("useIncrementalCollection", () => {
  it("adds the next batch when the scroll sentinel enters view", () => {
    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
    render(<CollectionHarness items={[1, 2, 3, 4, 5]} resetKey="all" />);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    act(() => {
      latestObserverCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("returns to the first batch when filters change", () => {
    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
    const view = render(<CollectionHarness items={[1, 2, 3, 4]} resetKey="all" />);

    act(() => {
      latestObserverCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(4);

    view.rerender(<CollectionHarness items={[1, 3]} resetKey="filtered" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("adds the next batch on scroll when the observer misses the sentinel", () => {
    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
    render(<CollectionHarness items={[1, 2, 3, 4, 5]} resetKey="all" />);
    vi.spyOn(screen.getByTestId("collection-sentinel"), "getBoundingClientRect").mockReturnValue({
      bottom: 900,
      height: 20,
      left: 0,
      right: 100,
      top: 880,
      width: 100,
      x: 0,
      y: 880,
      toJSON: () => ({}),
    });

    act(() => window.dispatchEvent(new Event("scroll")));

    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });
});
