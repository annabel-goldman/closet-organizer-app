import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExpandedImageEditor } from "../../src/app/components/ExpandedImageEditor";

afterEach(cleanup);

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

  it("lets the editor return to each durable image version", async () => {
    const generatedLoader = vi.fn(async () => new File(["generated"], "generated.png", {
      type: "image/png",
    }));
    const onApply = vi.fn();

    render(
      <ExpandedImageEditor
        getEditableFile={async () => new File(["original"], "original.png", { type: "image/png" })}
        imageActions={{
          initialKind: "base",
          versions: [
            { kind: "base", label: "Original", getFile: async () => null },
            { kind: "generated", label: "AI Generated", getFile: generatedLoader },
          ],
        }}
        onApply={onApply}
        sourceKey="item-1-original"
        title="Versioned item"
      />,
    );

    expect(await screen.findByText("Saved Versions")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "AI Generated" }));
    await waitFor(() => expect(generatedLoader).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Apply edited image" }));

    await waitFor(() => {
      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({ name: "generated.png" }),
        { imageKind: "generated" },
      );
    });
  });
});
