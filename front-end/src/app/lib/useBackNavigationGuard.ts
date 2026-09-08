import { useEffect, useRef } from "react";

const HISTORY_GUARD_KEY = "__closetBackNavigationGuard";

interface UseBackNavigationGuardOptions {
  active: boolean;
  blocked: boolean;
  guardId: string;
  onBackWithoutChanges: () => void;
  onBlockedBack: () => void;
}

export function useBackNavigationGuard({
  active,
  blocked,
  guardId,
  onBackWithoutChanges,
  onBlockedBack,
}: UseBackNavigationGuardOptions) {
  const blockedRef = useRef(blocked);
  const onBackWithoutChangesRef = useRef(onBackWithoutChanges);
  const onBlockedBackRef = useRef(onBlockedBack);

  blockedRef.current = blocked;
  onBackWithoutChangesRef.current = onBackWithoutChanges;
  onBlockedBackRef.current = onBlockedBack;

  useEffect(() => {
    if (!active) {
      return;
    }

    const guardedUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const currentState = isHistoryState(window.history.state) ? window.history.state : {};
    window.history.pushState(
      { ...currentState, [HISTORY_GUARD_KEY]: guardId },
      "",
      guardedUrl,
    );

    function handlePopState() {
      if (!blockedRef.current) {
        onBackWithoutChangesRef.current();
        return;
      }

      const nextState = isHistoryState(window.history.state) ? window.history.state : {};
      window.history.pushState(
        { ...nextState, [HISTORY_GUARD_KEY]: guardId },
        "",
        guardedUrl,
      );
      onBlockedBackRef.current();
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!blockedRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      if (
        isHistoryState(window.history.state)
        && window.history.state[HISTORY_GUARD_KEY] === guardId
      ) {
        window.history.back();
      }
    };
  }, [active, guardId]);
}

function isHistoryState(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
