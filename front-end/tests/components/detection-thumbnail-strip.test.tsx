import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DetectionThumbnailStrip } from "../../src/app/components/create-item/DetectionThumbnailStrip";

describe("DetectionThumbnailStrip", () => {
  it("shows every source photo and lets the user focus a specific one", () => {
    const onSelectSource = vi.fn();

    render(
      <DetectionThumbnailStrip
        detections={[]}
        focusedTarget="source"
        isDetecting={false}
        onSelectDetection={() => undefined}
        onSelectSource={onSelectSource}
        selectedDetectionIds={[]}
        selectedSourceIndex={0}
        sourceImages={[
          { id: "first", imageUrl: "blob:first", label: "front.jpg" },
          { id: "second", imageUrl: "blob:second", label: "back.jpg" },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Show source photo 1: front.jpg" }))
      .toBeInTheDocument();
    const secondSource = screen.getByRole("button", {
      name: "Show source photo 2: back.jpg",
    });
    expect(secondSource).toBeInTheDocument();

    fireEvent.click(secondSource);
    expect(onSelectSource).toHaveBeenCalledWith(1);
  });
});
