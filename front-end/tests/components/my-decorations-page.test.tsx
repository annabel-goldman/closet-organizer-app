import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MyDecorationsPage } from "../../src/app/components/MyDecorationsPage";

afterEach(cleanup);

describe("MyDecorationsPage", () => {
  it("bulk uploads PNG files and shows each completed decoration", async () => {
    const originalFetch = globalThis.fetch;
    let nextId = 1;
    globalThis.fetch = vi.fn(async (_input, init) => {
      if (!init?.method) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      const formData = init.body as FormData;
      const file = formData.get("decoration[image]") as File;
      const id = nextId++;
      return new Response(JSON.stringify({
        id,
        user_id: 1,
        name: file.name.replace(".png", ""),
        image_url: `/decorations/${id}.png`,
      }), { status: 201, headers: { "Content-Type": "application/json" } });
    });

    try {
      const { container } = render(<MyDecorationsPage />);
      await screen.findByText("Add your first PNG decorations");
      const input = container.querySelector<HTMLInputElement>('input[type="file"]');
      expect(input).not.toBeNull();

      fireEvent.change(input!, {
        target: {
          files: [
            new File(["one"], "gold-star.png", { type: "image/png" }),
            new File(["two"], "pink-heart.png", { type: "image/png" }),
          ],
        },
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue("gold-star")).toBeInTheDocument();
        expect(screen.getByDisplayValue("pink-heart")).toBeInTheDocument();
      });
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
