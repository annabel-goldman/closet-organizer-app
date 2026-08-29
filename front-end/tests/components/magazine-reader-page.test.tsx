import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MagazineReaderPage } from "../../src/app/components/MagazineReaderPage";

afterEach(cleanup);

describe("MagazineReaderPage", () => {
  it("loads as a full-page book and flips between the cover and looks", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      id: 8,
      user_id: 1,
      name: "Paris Weekend",
      occasion: null,
      notes: "Three days of polished looks",
      outfit_ids: [19],
      outfits: [{
        id: 19,
        user_id: 1,
        name: "Gallery Dinner Look",
        notes: "Polished layers",
        tags: ["gallery"],
        item_ids: [],
        items: [],
      }],
      decorations: [],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    try {
      render(<MagazineReaderPage magazineId={8} />);

      expect(await screen.findByRole("heading", { name: "Paris Weekend", level: 1 })).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByText("Private Lookbook")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Next magazine page" }));
      await waitFor(() => {
        expect(screen.getByText("Gallery Dinner Look")).toBeInTheDocument();
        expect(screen.getByText("2 / 2")).toBeInTheDocument();
      });

      fireEvent.keyDown(window, { key: "ArrowLeft" });
      await waitFor(() => expect(screen.getByText("Private Lookbook")).toBeInTheDocument());
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
