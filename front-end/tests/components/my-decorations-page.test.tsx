import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MyDecorationsPage } from "../../src/app/components/MyDecorationsPage";
import * as closet from "../../src/app/lib/closet";

const decoration: closet.Decoration = {
  id: 7,
  user_id: 1,
  name: "Pink hearts",
  image_url: "/decorations/pink-hearts.png",
  created_at: "2026-09-05T00:00:00Z",
  updated_at: "2026-09-05T00:00:00Z",
};

afterEach(cleanup);

describe("MyDecorationsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(closet, "fetchDecorations").mockResolvedValue([decoration]);
  });

  it("uses the dense shared card treatment and saves title edits inline", async () => {
    const updateDecoration = vi.spyOn(closet, "updateDecoration").mockResolvedValue({
      ...decoration,
      name: "Floating hearts",
    });

    render(<MyDecorationsPage />);

    const image = await screen.findByAltText("Pink hearts");
    const media = image.parentElement;
    const card = screen.getByRole("article");
    const titleInput = screen.getByRole("textbox", { name: "Name for Pink hearts" });

    expect(media).toHaveClass("bg-white");
    expect(media?.className).not.toContain("linear-gradient(45deg");
    expect(card.parentElement).toHaveClass("xl:grid-cols-6");
    expect(screen.getByRole("button", { name: "Edit Pink hearts" }).parentElement)
      .toHaveClass("opacity-0", "group-hover:opacity-100");

    fireEvent.change(titleInput, { target: { value: "Floating hearts" } });
    fireEvent.blur(titleInput);

    await waitFor(() => {
      expect(updateDecoration).toHaveBeenCalledWith(7, { name: "Floating hearts" });
    });
  });
});
