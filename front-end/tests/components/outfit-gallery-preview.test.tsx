import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OutfitGalleryPreview } from "../../src/app/components/OutfitGalleryPreview";
import type { Outfit } from "../../src/app/lib/closet";

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
    const { rerender } = render(<OutfitGalleryPreview outfit={outfit} view="flatlay" />);
    const previewFrame = screen.getByRole("region", {
      name: "Night Gallery flat lay preview",
    });

    expect(screen.getByAltText("Black Evening Dress")).toBeInTheDocument();
    expect(previewFrame).toHaveClass("aspect-[4/5]", "overflow-hidden");

    rerender(<OutfitGalleryPreview outfit={outfit} view="modeled" />);

    expect(await screen.findByAltText("Modeled version of Night Gallery")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Night Gallery modeled preview" }))
      .toBe(previewFrame);
  });
});
