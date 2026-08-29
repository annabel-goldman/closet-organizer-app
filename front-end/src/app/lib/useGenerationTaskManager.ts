import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  cancelAiWorkflow,
  fetchAiWorkflow,
} from "./api/workflows";
import type { AiWorkflow } from "./types/ai";
import type { GenerationTask } from "./generationTasks";

type WorkflowUpdateReason = "cancel" | "poll";

interface UseGenerationTaskManagerOptions {
  cancelWorkflow?: typeof cancelAiWorkflow;
  fetchWorkflow?: typeof fetchAiWorkflow;
  ownerId?: number | null;
  onWorkflowUpdated?: (
    workflow: AiWorkflow,
    reason: WorkflowUpdateReason,
    signal?: AbortSignal,
  ) => Promise<void> | void;
  pollIntervalMs?: number;
}

const ACTIVE_STATUSES = new Set<AiWorkflow["status"]>(["pending", "processing"]);
const REMOVED_STATUSES = new Set<AiWorkflow["status"]>(["deleted", "rejected"]);

export function useGenerationTaskManager({
  cancelWorkflow = cancelAiWorkflow,
  fetchWorkflow = fetchAiWorkflow,
  ownerId,
  onWorkflowUpdated,
  pollIntervalMs = 1400,
}: UseGenerationTaskManagerOptions = {}) {
  const [tasks, setTasks] = useState<Record<number, GenerationTask>>({});
  const workflowUpdateRef = useRef(onWorkflowUpdated);

  useEffect(() => {
    workflowUpdateRef.current = onWorkflowUpdated;
  }, [onWorkflowUpdated]);

  useEffect(() => {
    setTasks({});
  }, [ownerId]);

  const activeWorkflowIds = useMemo(
    () => Object.values(tasks)
      .filter((task) => ACTIVE_STATUSES.has(task.workflow.status))
      .map((task) => task.workflow.id)
      .sort((left, right) => left - right),
    [tasks],
  );
  const activeWorkflowKey = activeWorkflowIds.join(":");

  useEffect(() => {
    if (!activeWorkflowKey) {
      return;
    }

    const workflowIds = activeWorkflowKey.split(":").map(Number);
    const controller = new AbortController();
    let timeoutId: number | undefined;

    const poll = async () => {
      await Promise.all(workflowIds.map(async (workflowId) => {
        try {
          const workflow = await fetchWorkflow(workflowId, controller.signal);
          await workflowUpdateRef.current?.(workflow, "poll", controller.signal);
          setTasks((current) => {
            const task = current[workflowId];
            return task
              ? { ...current, [workflowId]: { ...task, workflow } }
              : current;
          });
        } catch {
          // A temporary refresh error should not end a durable background task.
        }
      }));

      if (!controller.signal.aborted) {
        timeoutId = window.setTimeout(() => void poll(), pollIntervalMs);
      }
    };

    timeoutId = window.setTimeout(() => void poll(), pollIntervalMs);

    return () => {
      controller.abort();
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeWorkflowKey, fetchWorkflow, pollIntervalMs]);

  const track = useCallback((workflow: AiWorkflow, label: string) => {
    setTasks((current) => {
      if (REMOVED_STATUSES.has(workflow.status)) {
        const next = { ...current };
        delete next[workflow.id];
        return next;
      }

      return {
        ...current,
        [workflow.id]: {
          label: current[workflow.id]?.label ?? label,
          workflow,
        },
      };
    });
  }, []);

  const updateTracked = useCallback((workflow: AiWorkflow, label: string) => {
    setTasks((current) => {
      if (REMOVED_STATUSES.has(workflow.status)) {
        const next = { ...current };
        delete next[workflow.id];
        return next;
      }

      const existing = current[workflow.id];
      if (!existing && !ACTIVE_STATUSES.has(workflow.status)) {
        return current;
      }

      return {
        ...current,
        [workflow.id]: {
          label: existing?.label ?? label,
          workflow,
        },
      };
    });
  }, []);

  const cancel = useCallback(async (workflowId: number) => {
    setTasks((current) => {
      const task = current[workflowId];
      return task
        ? { ...current, [workflowId]: { ...task, isCancelling: true, cancelError: undefined } }
        : current;
    });

    try {
      const workflow = await cancelWorkflow(workflowId);
      await workflowUpdateRef.current?.(workflow, "cancel");
      setTasks((current) => {
        const task = current[workflowId];
        return task
          ? { ...current, [workflowId]: { ...task, workflow, isCancelling: false } }
          : current;
      });
    } catch (error) {
      setTasks((current) => {
        const task = current[workflowId];
        return task
          ? {
              ...current,
              [workflowId]: {
                ...task,
                isCancelling: false,
                cancelError: error instanceof Error ? error.message : "Unable to cancel this task.",
              },
            }
          : current;
      });
    }
  }, [cancelWorkflow]);

  const dismiss = useCallback((workflowId: number) => {
    setTasks((current) => {
      const next = { ...current };
      delete next[workflowId];
      return next;
    });
  }, []);

  return {
    cancel,
    dismiss,
    tasks,
    track,
    updateTracked,
  };
}
