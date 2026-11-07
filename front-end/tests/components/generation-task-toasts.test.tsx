import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

  it("confirms before cancelling an outfit cart generation", () => {
    const task: GenerationTask = {
      label: "your outfit",
      workflow: {
        id: 44,
        kind: "outfit_recommendation",
        status: "processing",
        completed_count: 0,
        failed_count: 0,
        stages: [{ key: "retrieve", status: "processing" }],
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

    expect(screen.getByLabelText("Generation activity")).toHaveAttribute(
      "data-generation-task-toasts",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).not.toHaveBeenCalled();

    const confirmation = screen.getByRole("alertdialog");
    expect(within(confirmation).getByText(/stop generating your outfit/i)).toBeInTheDocument();
    fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel generation" }));
    expect(onCancel).toHaveBeenCalledWith(44);

    fireEvent.click(screen.getByRole("button", {
      name: "Dismiss generation update for your outfit",
    }));
    expect(onDismiss).toHaveBeenCalledWith(44);
  });

  it("confirms before cancelling modeled generation", () => {
    const onCancel = vi.fn();
    render(
      <GenerationTaskToasts
        tasks={[{
          label: "Evening look",
          workflow: {
            id: 52,
            kind: "modeled_outfit",
            status: "processing",
            completed_count: 0,
            failed_count: 0,
            stages: [],
          },
        }]}
        onCancel={onCancel}
        onDismiss={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const confirmation = screen.getByRole("alertdialog");
    fireEvent.click(within(confirmation).getByRole("button", { name: "Keep generating" }));
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel generation" }));
    expect(onCancel).toHaveBeenCalledWith(52);
  });
});
