import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DecorationPickerPopover } from "../../src/app/components/decorations/DecorationPickerPopover";
import * as closet from "../../src/app/lib/closet";

afterEach(cleanup);

describe("DecorationPickerPopover", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(closet, "fetchDecorations").mockResolvedValue([{
      id: 2,
      user_id: 1,
      name: "Peach",
      image_url: "/peach.png",
      created_at: "2026-09-05T00:00:00Z",
      updated_at: "2026-09-05T00:00:00Z",
    }]);
  });

  it("uses the shared scrollable picker layout and dismisses a non-draggable tile after selection", async () => {
    const onSelect = vi.fn();
    render(<DecorationPickerPopover onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Add decoration" }));
    const peachButton = await screen.findByRole("button", { name: "Add Peach" });
    const scrollRegion = document.querySelector<HTMLElement>("[data-slot='picker-popover-scroll-region']");
    const pickerContent = scrollRegion?.parentElement;
    const peachImage = peachButton.querySelector<HTMLImageElement>("img");

    expect(scrollRegion?.className).toContain("overflow-y-auto");
    expect(scrollRegion?.className).toContain("overscroll-contain");
    expect(pickerContent?.style.maxHeight).toContain("--radix-popover-content-available-height");
    expect(peachImage?.draggable).toBe(false);
    expect(peachImage?.className).not.toContain("transition-transform");

    fireEvent.click(peachButton);

    expect(onSelect).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByPlaceholderText("Search decorations")).toBeNull());
  });
});
