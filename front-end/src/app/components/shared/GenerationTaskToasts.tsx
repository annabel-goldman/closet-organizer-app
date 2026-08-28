import { Check, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type GenerationTask,
  generationTaskLabel,
  generationTaskMessage,
  isGenerationTaskRunning,
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
  return (
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-[90] flex w-[min(24rem,calc(100vw-3rem))] flex-col gap-3"
      aria-label="Generation activity"
    >
      <AnimatePresence initial={false}>
        {tasks.map((task) => {
          const running = isGenerationTaskRunning(task);
          const failed = task.workflow.status === "failed" || Boolean(task.cancelError);
          const label = generationTaskLabel(task);

          return (
            <motion.section
              key={task.workflow.id}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="pointer-events-auto border border-foreground/15 bg-background/95 p-4 shadow-xl backdrop-blur"
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
                  {task.cancelError || task.workflow.error_message ? (
                    <PrimitiveText as="p" variant="caption" tone="destructive" className="mt-1">
                      {task.cancelError || task.workflow.error_message}
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
