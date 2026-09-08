import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GenerationTaskToasts } from "../../src/app/components/shared/GenerationTaskToasts";
import type { GenerationTask } from "../../src/app/lib/generationTasks";

afterEach(cleanup);

describe("GenerationTaskToasts", () => {
  it("dismisses a running notification without invoking cancellation", () => {
    const task: GenerationTask = {
      label: "Evening look",
      workflow: {
        id: 31,
        kind: "modeled_outfit",
        status: "processing",
        completed_count: 0,
        failed_count: 0,
        stages: [],
      },
    };
    const onCancel = vi.fn();
    const onDismiss = vi.fn();

    render(
      <GenerationTaskToasts
        tasks={[task]}
        onCancel={onCancel}
        onDismiss={onDismiss}
        onOpen={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", {
      name: "Dismiss generation update for Evening look",
    }));

    expect(onDismiss).toHaveBeenCalledWith(31);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
