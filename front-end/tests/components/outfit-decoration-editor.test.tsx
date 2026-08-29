import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OutfitCollageCanvas } from "../../src/app/components/OutfitCollageCanvas";
import { OutfitCollageLayersPanel } from "../../src/app/components/OutfitCollageLayersPanel";
import type { OutfitDecoration } from "../../src/app/lib/closet";
import type { ImageContentBounds } from "../../src/app/lib/outfitImageBounds";

const mocks = vi.hoisted(() => ({
  measureImageContentBounds: vi.fn(),
  moveableProps: null as Record<string, unknown> | null,
}));

vi.mock("../../src/app/lib/outfitImageBounds", () => ({
  measureImageContentBounds: mocks.measureImageContentBounds,
}));

vi.mock("react-moveable", () => ({
  default: (props: Record<string, unknown>) => {
    mocks.moveableProps = props;
    return null;
  },
}));

const decoration: OutfitDecoration = {
  id: 9,
  outfit_id: 4,
  decoration_id: 2,
  name: "Peach",
  image_url: "/peach.png",
  x: 16,
  y: 27,
  width: 20,
  rotation: 0,
  layer_order: 0,
};

afterEach(cleanup);

describe("outfit decoration editing", () => {
  beforeEach(() => {
    mocks.measureImageContentBounds.mockReset();
    mocks.moveableProps = null;
  });

  it("renders one cropped decoration with the same transform controls as outfit items", async () => {
    let resolveMeasurement: ((bounds: ImageContentBounds) => void) | undefined;
    mocks.measureImageContentBounds.mockReturnValue(new Promise<ImageContentBounds>((resolve) => {
      resolveMeasurement = resolve;
    }));

    const { container } = render(
      <OutfitCollageCanvas
        decorations={[decoration]}
        editable
        items={[]}
        selectedDecorationId={decoration.id}
        onDecorationChange={() => undefined}
      />,
    );

    expect(container.querySelectorAll("[data-collage-decoration-frame='true']")).toHaveLength(1);
    await waitFor(() => expect(mocks.moveableProps).not.toBeNull());
    expect(mocks.moveableProps?.draggable).toBe(true);
    expect(mocks.moveableProps?.resizable).toBe(false);
    expect(mocks.moveableProps?.rotatable).toBe(true);

    await act(async () => {
      resolveMeasurement?.({
        aspectRatio: 0.5,
        heightFraction: 0.8,
        leftFraction: 0.25,
        topFraction: 0.1,
        widthFraction: 0.4,
      });
    });

    await waitFor(() => expect(mocks.moveableProps?.resizable).toBe(true));
    const frame = container.querySelector<HTMLElement>("[data-collage-decoration-frame='true']");
    expect(frame?.style.height).toBe("32%");

    const setRatio = vi.fn();
    (mocks.moveableProps?.onResizeStart as (event: unknown) => void)({
      dragStart: { set: vi.fn() },
      setRatio,
    });
    expect(setRatio).toHaveBeenCalledWith(0.5);
  });

  it("shows decorations in the layers rail with selection and removal actions", () => {
    mocks.measureImageContentBounds.mockResolvedValue(null);
    const onRemoveDecoration = vi.fn();
    const onSelectDecoration = vi.fn();

    render(
      <OutfitCollageLayersPanel
        availableItems={[]}
        decorations={[decoration]}
        items={[]}
        layouts={{}}
        onAddDecoration={() => undefined}
        onAddItem={() => undefined}
        onRemoveDecoration={onRemoveDecoration}
        onRemoveItem={() => undefined}
        onReorder={() => undefined}
        onSelectDecoration={onSelectDecoration}
        onSelectItem={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select decoration Peach" }));
    expect(onSelectDecoration).toHaveBeenCalledWith(decoration.id);

    fireEvent.click(screen.getByRole("button", { name: "Remove Peach from outfit" }));
    expect(onRemoveDecoration).toHaveBeenCalledWith(decoration);
    expect(screen.getByRole("button", { name: "Add decoration to flat lay" })).toBeTruthy();
  });
});
