import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MagazineEditorForm } from "../../src/app/components/MagazineEditorForm";
import type { Outfit, OutfitFolder } from "../../src/app/lib/closet";

afterEach(cleanup);

describe("MagazineEditorForm", () => {
  it("creates magazines without exposing or submitting a style choice", () => {
    const onSave = vi.fn();

    render(
      <MagazineEditorForm
        isSaving={false}
        onCancel={() => undefined}
        onSave={onSave}
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
      pageLayouts: {},
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
        <MagazineEditorForm
          isSaving={false}
          onCancel={() => undefined}
          onSave={() => undefined}
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
      <MagazineEditorForm
        isSaving={false}
        onCancel={() => undefined}
        onSave={() => undefined}
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

  it("designs saved magazine pages with editable text and per-page image modes", () => {
    const onSave = vi.fn();
    const outfit: Outfit = {
      id: 19,
      user_id: 1,
      name: "Gallery Dinner Look",
      tags: ["gallery"],
      notes: "Polished layers",
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
            file_url: "/modeled/gallery.png",
          }],
        }],
      },
    };
    const folder: OutfitFolder = {
      id: 8,
      user_id: 1,
      name: "Paris Weekend",
      notes: "Three polished days",
      outfit_ids: [19],
      outfits: [outfit],
      decorations: [],
      page_layouts: {},
    };

    render(
      <MagazineEditorForm
        folder={folder}
        isSaving={false}
        onCancel={() => undefined}
        onSave={onSave}
        outfits={[outfit]}
      />,
    );

    expect(screen.getByRole("button", { name: "Decorate this magazine page" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Page 2.*Gallery Dinner Look/ }));
    expect(screen.getByRole("button", { name: "Model" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Flat lay" }));

    const pageTitle = screen.getByRole("heading", { name: "Gallery Dinner Look", level: 2 });
    fireEvent.pointerDown(pageTitle, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(window);
    fireEvent.change(screen.getByLabelText("Magazine page title"), {
      target: { value: "Left Bank Dinner" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save magazine" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      pageLayouts: expect.objectContaining({
        "outfit:19": expect.objectContaining({
          image_mode: "flatlay",
          title: expect.objectContaining({ text: "Left Bank Dinner" }),
        }),
      }),
    }));
  });
});
