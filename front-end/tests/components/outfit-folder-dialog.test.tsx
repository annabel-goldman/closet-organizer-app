import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OutfitFolderDialog } from "../../src/app/components/OutfitFolderDialog";

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
});
