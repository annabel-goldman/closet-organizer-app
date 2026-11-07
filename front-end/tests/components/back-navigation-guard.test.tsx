import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBackNavigationGuard } from "../../src/app/lib/useBackNavigationGuard";

beforeEach(() => {
  window.history.replaceState({}, "", "/outfits");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/outfits");
});

function GuardHarness({
  blocked,
  onBackWithoutChanges,
  onBlockedBack,
}: {
  blocked: boolean;
  onBackWithoutChanges: () => void;
  onBlockedBack: () => void;
}) {
  useBackNavigationGuard({
    active: true,
    blocked,
    guardId: "outfit-editor-12",
    onBackWithoutChanges,
    onBlockedBack,
  });

  return null;
}

describe("useBackNavigationGuard", () => {
  it("blocks back navigation and warns while the editor has unsaved changes", () => {
    vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    const onBackWithoutChanges = vi.fn();
    const onBlockedBack = vi.fn();

    render(
      <GuardHarness
        blocked
        onBackWithoutChanges={onBackWithoutChanges}
        onBlockedBack={onBlockedBack}
      />,
    );

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(onBlockedBack).toHaveBeenCalledOnce();
    expect(onBackWithoutChanges).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/outfits");
  });

  it("lets a back action close an unchanged editor", () => {
    vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    const onBackWithoutChanges = vi.fn();
    const onBlockedBack = vi.fn();

    render(
      <GuardHarness
        blocked={false}
        onBackWithoutChanges={onBackWithoutChanges}
        onBlockedBack={onBlockedBack}
      />,
    );

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(onBackWithoutChanges).toHaveBeenCalledOnce();
    expect(onBlockedBack).not.toHaveBeenCalled();
  });
});
