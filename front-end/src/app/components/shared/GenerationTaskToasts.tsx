import { Check, Copy, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  type GenerationTask,
  generationTaskLabel,
  generationTaskMessage,
  isGenerationTaskRunning,
  isGenerationTaskSuccessful,
} from "../../lib/generationTasks";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { PrimitiveText } from "../primitives/PrimitiveText";

interface GenerationTaskToastsProps {
  tasks: GenerationTask[];
  onCancel: (workflowId: number) => void;
  onDismiss: (workflowId: number) => void;
  onOpen: (workflow: GenerationTask["workflow"]) => void;
}

export function GenerationTaskToasts({
  tasks,
  onCancel,
  onDismiss,
  onOpen,
}: GenerationTaskToastsProps) {
  const dismissTimersRef = useRef(new Map<number, number>());
  const onDismissRef = useRef(onDismiss);
  const [copiedWorkflowId, setCopiedWorkflowId] = useState<number | null>(null);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const successfulWorkflowIds = new Set(
      tasks.filter(isGenerationTaskSuccessful).map((task) => task.workflow.id),
    );

    successfulWorkflowIds.forEach((workflowId) => {
      if (dismissTimersRef.current.has(workflowId)) {
        return;
      }

      const timer = window.setTimeout(() => {
        dismissTimersRef.current.delete(workflowId);
        onDismissRef.current(workflowId);
      }, 3000);
      dismissTimersRef.current.set(workflowId, timer);
    });

    dismissTimersRef.current.forEach((timer, workflowId) => {
      if (!successfulWorkflowIds.has(workflowId)) {
        window.clearTimeout(timer);
        dismissTimersRef.current.delete(workflowId);
      }
    });
  }, [tasks]);

  useEffect(() => () => {
    dismissTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    dismissTimersRef.current.clear();
  }, []);

  async function copyErrorMessage(workflowId: number, message: string) {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedWorkflowId(workflowId);
      window.setTimeout(() => {
        setCopiedWorkflowId((current) => (current === workflowId ? null : current));
      }, 2000);
    } catch {
      setCopiedWorkflowId(null);
    }
  }

  return (
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-[90] flex w-[min(24rem,calc(100vw-3rem))] flex-col gap-3"
      aria-label="Generation activity"
    >
      <AnimatePresence initial={false}>
        {tasks.map((task) => {
          const running = isGenerationTaskRunning(task);
          const failed = task.workflow.status === "failed" || Boolean(task.cancelError);
          const successful = isGenerationTaskSuccessful(task);
          const label = generationTaskLabel(task);
          const errorMessage = task.cancelError
            || task.workflow.error_message
            || "Generation failed without an error message.";

          return (
            <motion.section
              key={task.workflow.id}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className={`pointer-events-auto border p-4 shadow-xl backdrop-blur ${
                failed
                  ? "border-red-200 bg-red-50/95"
                  : successful
                    ? "border-emerald-200 bg-emerald-50/95"
                    : "border-foreground/15 bg-background/95"
              }`}
              role={failed ? "alert" : "status"}
              aria-live={failed ? "assertive" : "polite"}
              aria-atomic="true"
            >
              <div className="flex items-start gap-3">
                {running ? (
                  <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                ) : failed ? (
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                ) : (
                  <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                )}

                <div className="min-w-0 flex-1">
                  <PrimitiveText as="p" variant="bodySm">
                    {generationTaskMessage(task)} <strong>{label}</strong>
                  </PrimitiveText>
                  {failed ? (
                    <PrimitiveText as="p" variant="caption" tone="destructive" className="mt-1">
                      {errorMessage}
                    </PrimitiveText>
                  ) : null}
                </div>

                {running ? (
                  <PrimitiveButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={task.isCancelling}
                    onClick={() => onCancel(task.workflow.id)}
                    className="-mr-2 -mt-2"
                  >
                    {task.isCancelling ? "Cancelling…" : "Cancel"}
                  </PrimitiveButton>
                ) : (
                  <div className="-mr-2 -mt-2 flex items-center gap-1">
                    {failed ? (
                      <PrimitiveButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void copyErrorMessage(task.workflow.id, errorMessage)}
                        aria-label={`Copy generation error for ${label}`}
                      >
                        <Copy aria-hidden="true" />
                        {copiedWorkflowId === task.workflow.id ? "Copied" : "Copy error"}
                      </PrimitiveButton>
                    ) : null}
                    {["review", "succeeded"].includes(task.workflow.status) ? (
                      <PrimitiveButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpen(task.workflow)}
                      >
                        View
                      </PrimitiveButton>
                    ) : null}
                    <PrimitiveButton
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onDismiss(task.workflow.id)}
                      aria-label={`Dismiss generation update for ${label}`}
                      className="h-8 w-8"
                    >
                      <X aria-hidden="true" />
                    </PrimitiveButton>
                  </div>
                )}
              </div>
            </motion.section>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
