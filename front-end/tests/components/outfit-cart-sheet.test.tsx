import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OutfitCartSheet } from "../../src/app/components/OutfitCartSheet";

afterEach(cleanup);

const baseProps = {
  createErrorMessage: "",
  generationMessage: null,
  isCreating: false,
  isClearingOutfit: false,
  isGeneratingOutfit: false,
  isOpen: true,
  items: [],
  notes: "",
  onCreateOutfit: vi.fn(),
  onClearOutfit: vi.fn(),
  onGenerateOutfit: vi.fn(),
  onNotesChange: vi.fn(),
  onOpenChange: vi.fn(),
  onOutfitNameChange: vi.fn(),
  onRemoveItem: vi.fn(),
  onTagInputChange: vi.fn(),
  outfitName: "",
  tagInput: "",
};

describe("OutfitCartSheet", () => {
  it("allows generating a complete outfit from an empty cart", () => {
    render(<OutfitCartSheet {...baseProps} />);

    expect(screen.getByRole("button", { name: "Generate an outfit" })).toBeEnabled();
    expect(screen.getByText(/sparkle button to generate a look/i)).toBeInTheDocument();
  });

  it("describes selected cart pieces as anchors", () => {
    render(
      <OutfitCartSheet
        {...baseProps}
        items={[{
          id: 4,
          user_id: 1,
          name: "Burgundy Cardigan",
          category: "top",
          size: "na",
          date: null,
          tags: [ "burgundy" ],
          image_url: "/cardigan.png",
        }]}
      />,
    );

    expect(screen.getByRole("button", { name: "Build an outfit around selected pieces" })).toBeEnabled();
    expect(screen.queryByText(/ready to turn into an outfit/i)).not.toBeInTheDocument();
  });

  it("allows the cart to close while generation continues without duplicate status copy", () => {
    const onOpenChange = vi.fn();
    render(
      <OutfitCartSheet
        {...baseProps}
        isGeneratingOutfit
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.queryByText("Finding pieces for your outfit…")).not.toBeInTheDocument();
    expect(screen.queryByText(/close this cart while the outfit builds/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("confirms before clearing the complete draft", () => {
    const onClearOutfit = vi.fn();
    render(
      <OutfitCartSheet
        {...baseProps}
        outfitName="Generated Look"
        onClearOutfit={onClearOutfit}
        items={[{
          id: 4,
          user_id: 1,
          name: "Burgundy Cardigan",
          category: "top",
          size: "na",
          date: null,
          tags: [ "burgundy" ],
          image_url: "/cardigan.png",
        }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear outfit" }));
    const confirmation = screen.getByRole("alertdialog");
    expect(confirmation).toBeInTheDocument();
    expect(onClearOutfit).not.toHaveBeenCalled();

    fireEvent.click(within(confirmation).getByRole("button", { name: "Clear outfit" }));
    expect(onClearOutfit).toHaveBeenCalledTimes(1);
  });
});
