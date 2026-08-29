import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OutfitFolderDialog } from "../../src/app/components/OutfitFolderDialog";
import type { Outfit } from "../../src/app/lib/closet";

afterEach(cleanup);

describe("OutfitFolderDialog", () => {
  it("creates magazines without exposing or submitting a style choice", () => {
    const onSave = vi.fn();

    render(
      <OutfitFolderDialog
        isSaving={false}
        onOpenChange={() => undefined}
        onSave={onSave}
        open
        outfits={[]}
      />,
    );

    expect(screen.queryByText("Magazine style")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Magazine name"), {
      target: { value: "Paris weekend" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create magazine" }));

    expect(onSave).toHaveBeenCalledWith({
      name: "Paris weekend",
      notes: "",
      outfitIds: [],
    });
  });

  it("fills an editable magazine concept and selects suggested outfits", async () => {
    const originalFetch = globalThis.fetch;
    const outfit = {
      id: 19,
      user_id: 1,
      name: "Gallery Dinner Look",
      tags: ["gallery", "evening"],
      notes: "Polished layers",
      item_ids: [],
      items: [],
    };
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      name: "Paris After Dark",
      notes: "A polished sequence for gallery afternoons and late dinners.",
      outfit_ids: [19],
      provider: "openrouter",
      model: "test/metadata",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    try {
      render(
        <OutfitFolderDialog
          isSaving={false}
          onOpenChange={() => undefined}
          onSave={() => undefined}
          open
          outfits={[outfit]}
        />,
      );

      fireEvent.change(screen.getByLabelText("Magazine name"), {
        target: { value: "Paris" },
      });
      fireEvent.change(screen.getByLabelText("Notes"), {
        target: { value: "Gallery and dinner" },
      });
      fireEvent.click(screen.getByRole("button", {
        name: "AI fill magazine details and outfits",
      }));

      await waitFor(() => {
        expect(screen.getByLabelText("Magazine name")).toHaveValue("Paris After Dark");
        expect(screen.getByLabelText("Notes")).toHaveValue(
          "A polished sequence for gallery afternoons and late dinners.",
        );
        expect(screen.getByRole("checkbox", { name: /Gallery Dinner Look/ })).toBeChecked();
      });
      expect(screen.getByText(/Review everything before saving/)).toBeInTheDocument();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("shows modeled or flat-lay previews and filters outfits by search", () => {
    const outfits: Outfit[] = [
      {
        id: 19,
        user_id: 1,
        name: "Night Gallery",
        tags: ["evening"],
        notes: "Dinner afterward",
        item_ids: [],
        items: [],
        modeled_workflow: {
          id: 4,
          kind: "modeled_outfit",
          status: "succeeded",
          completed_count: 1,
          failed_count: 0,
          stages: [{
            key: "modeled",
            status: "approved",
            artifacts: [{
              id: 5,
              kind: "modeled_outfit_image",
              status: "approved",
              file_url: "/modeled/night-gallery.png",
            }],
          }],
        },
      },
      {
        id: 20,
        user_id: 1,
        name: "Denim Weekend",
        tags: ["casual"],
        notes: "Saturday errands",
        item_ids: [31],
        items: [{
          id: 31,
          user_id: 1,
          name: "Indigo Denim Skirt",
          category: "bottom",
          size: "medium",
          date: null,
          tags: ["denim", "blue"],
          image_url: "/items/denim-skirt.png",
        }],
      },
    ];

    render(
      <OutfitFolderDialog
        isSaving={false}
        onOpenChange={() => undefined}
        onSave={() => undefined}
        open
        outfits={outfits}
      />,
    );

    expect(screen.getByAltText("Modeled version of Night Gallery")).toBeInTheDocument();
    expect(screen.getByAltText("Indigo Denim Skirt")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Night Gallery" }));
    expect(screen.getByRole("checkbox", { name: "Select Night Gallery" })).toBeChecked();

    fireEvent.change(screen.getByRole("textbox", { name: "Search outfits" }), {
      target: { value: "denim blue" },
    });

    expect(screen.queryByText("Night Gallery")).not.toBeInTheDocument();
    expect(screen.getByText("Denim Weekend")).toBeInTheDocument();
  });
});
