import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OutfitCollageCanvas } from "../../src/app/components/OutfitCollageCanvas";
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

afterEach(cleanup);

describe("OutfitCollageCanvas first resize", () => {
  beforeEach(() => {
    mocks.measureImageContentBounds.mockReset();
    mocks.moveableProps = null;
  });

  it("waits for visible image bounds so the first resize uses the garment ratio", async () => {
    let resolveMeasurement: ((bounds: ImageContentBounds) => void) | undefined;
    mocks.measureImageContentBounds.mockReturnValue(new Promise<ImageContentBounds>((resolve) => {
      resolveMeasurement = resolve;
    }));

    render(
      <OutfitCollageCanvas
        editable
        items={[{
          id: 31,
          user_id: 1,
          name: "Portrait dress",
          category: "dress",
          size: "medium",
          date: null,
          tags: [],
          image_url: "/portrait-dress.png",
        }]}
        layouts={{
          31: { x: 20, y: 20, width: 40, height: 40, rotation: 0, layer_order: 0 },
        }}
        selectedItemId={31}
        onLayoutsChange={() => undefined}
      />,
    );

    await waitFor(() => expect(mocks.moveableProps).not.toBeNull());
    expect(mocks.moveableProps?.resizable).toBe(false);

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
    const setRatio = vi.fn();
    const setDragOrigin = vi.fn();
    (mocks.moveableProps?.onResizeStart as (event: unknown) => void)({
      dragStart: { set: setDragOrigin },
      setRatio,
    });

    expect(setRatio).toHaveBeenCalledWith(0.5);
    expect(setDragOrigin).toHaveBeenCalledWith([0, 0]);
  });
});
