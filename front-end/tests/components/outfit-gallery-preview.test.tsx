import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OutfitGalleryPreview } from "../../src/app/components/OutfitGalleryPreview";
import type { Outfit } from "../../src/app/lib/closet";

afterEach(cleanup);

const outfit: Outfit = {
  id: 19,
  user_id: 1,
  name: "Night Gallery",
  tags: ["evening"],
  notes: "Dinner afterward",
  item_ids: [31],
  items: [{
    id: 31,
    user_id: 1,
    name: "Black Evening Dress",
    category: "dress",
    size: "medium",
    date: null,
    tags: ["black", "evening"],
    image_url: "/items/black-dress.png",
  }],
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
};

describe("OutfitGalleryPreview", () => {
  it("keeps a stable preview frame while transitioning between views", async () => {
    const { rerender } = render(
      <OutfitGalleryPreview className="max-w-none" outfit={outfit} view="flatlay" />,
    );
    const previewFrame = screen.getByRole("region", {
      name: "Night Gallery flat lay preview",
    });

    expect(screen.getByAltText("Black Evening Dress")).toBeInTheDocument();
    expect(previewFrame).toHaveClass("aspect-[4/5]", "max-w-none", "overflow-hidden");
    expect(previewFrame).not.toHaveClass("max-w-[15.5rem]");

    rerender(<OutfitGalleryPreview className="max-w-none" outfit={outfit} view="modeled" />);

    expect(await screen.findByAltText("Modeled version of Night Gallery")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Night Gallery modeled preview" }))
      .toBe(previewFrame);
  });

  it("renders every saved piece in the gallery flat lay", () => {
    const items = Array.from({ length: 8 }, (_, index) => ({
      ...outfit.items[0],
      id: index + 1,
      name: `Outfit piece ${index + 1}`,
      image_url: `/items/piece-${index + 1}.png`,
    }));

    render(
      <OutfitGalleryPreview
        outfit={{
          ...outfit,
          item_ids: items.map((item) => item.id),
          items,
        }}
        view="flatlay"
      />,
    );

    expect(screen.getAllByRole("img")).toHaveLength(8);
    expect(screen.queryByText("+2")).not.toBeInTheDocument();
  });
});
