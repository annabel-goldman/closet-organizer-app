import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AiWorkflow } from "../../src/app/lib/types/ai";
import { useGenerationTaskManager } from "../../src/app/lib/useGenerationTaskManager";

const pendingWorkflow: AiWorkflow = {
  id: 24,
  kind: "outfit_recommendation",
  status: "processing",
  completed_count: 0,
  failed_count: 0,
  stages: [],
};

describe("useGenerationTaskManager", () => {
  afterEach(() => vi.useRealTimers());

  it("never overlaps polls for the same active workflow", async () => {
    vi.useFakeTimers();
    let resolvePoll: ((workflow: AiWorkflow) => void) | undefined;
    const fetchWorkflow = vi.fn(() => new Promise<AiWorkflow>((resolve) => {
      resolvePoll = resolve;
    }));
    const { result } = renderHook(() => useGenerationTaskManager({
      cancelWorkflow: vi.fn(),
      fetchWorkflow,
      pollIntervalMs: 20,
    }));

    act(() => result.current.track(pendingWorkflow, "Outfit 86"));
    await act(async () => vi.advanceTimersByTimeAsync(20));
    expect(fetchWorkflow).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(200));
    expect(fetchWorkflow).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePoll?.(pendingWorkflow);
      await Promise.resolve();
    });
    await act(async () => vi.advanceTimersByTimeAsync(20));
    expect(fetchWorkflow).toHaveBeenCalledTimes(2);
  });

  it("keeps polling a dismissed active toast until the workflow finishes", async () => {
    vi.useFakeTimers();
    const completedWorkflow: AiWorkflow = {
      ...pendingWorkflow,
      status: "succeeded",
      completed_count: 1,
    };
    const fetchWorkflow = vi.fn().mockResolvedValue(completedWorkflow);
    const onWorkflowUpdated = vi.fn();
    const cancelWorkflow = vi.fn();
    const { result } = renderHook(() => useGenerationTaskManager({
      cancelWorkflow,
      fetchWorkflow,
      onWorkflowUpdated,
      pollIntervalMs: 20,
    }));

    act(() => result.current.track(pendingWorkflow, "Outfit 86"));
    act(() => result.current.dismiss(pendingWorkflow.id));

    expect(result.current.tasks[pendingWorkflow.id]?.isDismissed).toBe(true);
    expect(cancelWorkflow).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTimeAsync(20));

    expect(fetchWorkflow).toHaveBeenCalledWith(pendingWorkflow.id, expect.any(AbortSignal));
    expect(onWorkflowUpdated).toHaveBeenCalledWith(completedWorkflow, "poll", expect.any(AbortSignal));
    expect(result.current.tasks[pendingWorkflow.id]).toBeUndefined();
  });
});
