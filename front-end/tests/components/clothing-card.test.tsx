import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClothingCard } from "../../src/app/components/ClothingCard";

const mocks = vi.hoisted(() => ({
  measureImageContentBounds: vi.fn(),
}));

vi.mock("../../src/app/lib/outfitImageBounds", () => ({
  isFullImageContentBounds: (bounds: {
    heightFraction: number;
    leftFraction: number;
    topFraction: number;
    widthFraction: number;
  }) => (
    bounds.leftFraction === 0
    && bounds.topFraction === 0
    && bounds.widthFraction === 1
    && bounds.heightFraction === 1
  ),
  measureImageContentBounds: mocks.measureImageContentBounds,
}));

afterEach(cleanup);

describe("ClothingCard", () => {
  beforeEach(() => {
    mocks.measureImageContentBounds.mockReset();
    mocks.measureImageContentBounds.mockResolvedValue(null);
  });

  it("keeps selection and outfit actions independently available", () => {
    const onSelect = vi.fn();
    const onAddToOutfit = vi.fn();

    render(
      <ClothingCard
        id={12}
        name="Silk blouse"
        tags={["top", "ivory"]}
        image_url="/items/silk-blouse.png"
        onSelect={onSelect}
        onAddToOutfit={onAddToOutfit}
      />,
    );

    expect(screen.getByRole("article")).not.toHaveClass("max-w-[22rem]");
    expect(screen.getByRole("img", { name: "Silk blouse" })).toHaveClass("object-contain");
    expect(screen.getByRole("img", { name: "Silk blouse" })).not.toHaveClass("group-hover:scale-[1.03]");
    const addButton = screen.getByRole("button", { name: "Add Silk blouse to outfit" });
    expect(addButton.parentElement).toHaveClass("opacity-0", "group-hover:opacity-100");
    fireEvent.click(addButton);
    expect(onAddToOutfit).toHaveBeenCalledWith(12);
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Open Silk blouse" }));
    expect(onSelect).toHaveBeenCalledWith(12);
  });

  it("fits the visible pixels instead of transparent source padding", async () => {
    mocks.measureImageContentBounds.mockResolvedValue({
      aspectRatio: 0.5,
      heightFraction: 0.8,
      leftFraction: 0.25,
      topFraction: 0.1,
      widthFraction: 0.4,
    });

    const { container } = render(
      <ClothingCard
        id={18}
        name="Padded dress"
        tags={["dress"]}
        image_url="/items/padded-dress.png"
      />,
    );

    fireEvent.load(screen.getByRole("img", { name: "Padded dress" }));

    await waitFor(() => {
      expect(mocks.measureImageContentBounds).toHaveBeenCalledWith({
        imageUrl: "/items/padded-dress.png",
      });
      expect(container.querySelector("[data-content-aware-image='true']")).not.toBeNull();
    });

    const contentAwareImage = container.querySelector("[data-content-aware-image='true']");
    expect(contentAwareImage).toHaveAttribute("viewBox", "0.25 0.1 0.4 0.8");
    expect(contentAwareImage).toHaveAttribute("preserveAspectRatio", "xMidYMid meet");
  });
});
