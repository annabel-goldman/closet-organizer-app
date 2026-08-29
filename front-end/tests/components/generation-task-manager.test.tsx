import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AiWorkflow } from "../../src/app/lib/types/ai";
import { useGenerationTaskManager } from "../../src/app/lib/useGenerationTaskManager";

const pendingWorkflow: AiWorkflow = {
  id: 24,
  kind: "modeled_outfit",
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
});
