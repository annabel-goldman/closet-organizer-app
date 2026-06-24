import { useMemo, useState } from "react";

export type AiActionStatus = "idle" | "running" | "succeeded" | "failed" | "invalidated";

export function useAiActionState(initialStatus: AiActionStatus = "idle") {
  const [status, setStatus] = useState<AiActionStatus>(initialStatus);
  const [errorMessage, setErrorMessage] = useState("");

  const state = useMemo(
    () => ({
      errorMessage,
      isFailed: status === "failed",
      isIdle: status === "idle",
      isInvalidated: status === "invalidated",
      isRunning: status === "running",
      isSucceeded: status === "succeeded",
      status,
    }),
    [errorMessage, status],
  );

  return {
    ...state,
    fail(nextErrorMessage = "") {
      setStatus("failed");
      setErrorMessage(nextErrorMessage);
    },
    invalidate() {
      setStatus("invalidated");
      setErrorMessage("");
    },
    reset() {
      setStatus("idle");
      setErrorMessage("");
    },
    start() {
      setStatus("running");
      setErrorMessage("");
    },
    succeed() {
      setStatus("succeeded");
      setErrorMessage("");
    },
  };
}
