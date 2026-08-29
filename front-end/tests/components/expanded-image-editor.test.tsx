import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExpandedImageEditor } from "../../src/app/components/ExpandedImageEditor";

describe("ExpandedImageEditor", () => {
  it("keeps loading the same source across unrelated parent rerenders", async () => {
    let resolveFile: ((file: File) => void) | undefined;
    const pendingFile = new Promise<File>((resolve) => {
      resolveFile = resolve;
    });
    const firstLoader = vi.fn(() => pendingFile);
    const replacementLoader = vi.fn(async () => new File(["replacement"], "replacement.png", {
      type: "image/png",
    }));

    const { rerender } = render(
      <ExpandedImageEditor
        getEditableFile={firstLoader}
        onApply={() => undefined}
        sourceKey="item-534-current-photo"
        title="Item 534"
      />,
    );

    rerender(
      <ExpandedImageEditor
        getEditableFile={replacementLoader}
        onApply={() => undefined}
        sourceKey="item-534-current-photo"
        title="Item 534"
      />,
    );

    resolveFile?.(new File(["original"], "original.png", { type: "image/png" }));

    expect(await screen.findByAltText("Item 534")).toBeInTheDocument();
    expect(firstLoader).toHaveBeenCalledTimes(1);
    expect(replacementLoader).not.toHaveBeenCalled();
  });
});
