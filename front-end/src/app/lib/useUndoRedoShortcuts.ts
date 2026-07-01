import { useEffect } from "react";

interface UseUndoRedoShortcutsOptions {
  canRedo: boolean;
  canUndo: boolean;
  disabled?: boolean;
  onRedo: () => void;
  onUndo: () => void;
}

export function useUndoRedoShortcuts({
  canRedo,
  canUndo,
  disabled = false,
  onRedo,
  onUndo,
}: UseUndoRedoShortcutsOptions) {
  useEffect(() => {
    if (disabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || !(event.metaKey || event.ctrlKey)) {
        return;
      }

      if (event.key.toLowerCase() !== "z") {
        return;
      }

      if (event.shiftKey) {
        if (!canRedo) {
          return;
        }

        event.preventDefault();
        onRedo();
        return;
      }

      if (!canUndo) {
        return;
      }

      event.preventDefault();
      onUndo();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canRedo, canUndo, disabled, onRedo, onUndo]);
}
