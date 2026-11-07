import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OutfitPreviewCarousel } from "../../src/app/components/OutfitPreviewCarousel";

describe("OutfitPreviewCarousel", () => {
  it("opens on the modeled outfit and navigates left to the flat lay", () => {
    render(
      <OutfitPreviewCarousel
        flatlay={<div>Editable flat lay</div>}
        initialSlide="modeled"
        modeledImageUrl="/modeled-look.png"
      />,
    );

    const carouselTrack = screen.getByText("Editable flat lay").parentElement?.parentElement;
    expect(carouselTrack).toHaveStyle({ transform: "translateX(-100%)" });

    fireEvent.click(screen.getByRole("button", { name: "View outfit flat lay" }));

    expect(carouselTrack).toHaveStyle({ transform: "translateX(0%)" });
    expect(screen.getByRole("button", { name: "View modeled outfit" })).toBeInTheDocument();
  });
});
