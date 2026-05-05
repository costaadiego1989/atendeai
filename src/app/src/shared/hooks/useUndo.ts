import { useRef, useCallback, useState, useEffect } from 'react';

export interface ExecuteUndoOptions {
  action: () => void;
  onUndo?: () => void;
  delayMs?: number;
}

export function useUndo() {
  const [hasPending, setHasPending] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const onUndoRef = useRef<(() => void) | null>(null);

  const clearPending = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingActionRef.current = null;
    onUndoRef.current = null;
    setHasPending(false);
  }, []);

  const flush = useCallback(() => {
    if (timeoutRef.current && pendingActionRef.current) {
      pendingActionRef.current();
      clearPending();
    }
  }, [clearPending]);

  const executeWithUndo = useCallback(
    ({ action, onUndo, delayMs = 4000 }: ExecuteUndoOptions) => {
      flush();

      pendingActionRef.current = action;
      if (onUndo) {
        onUndoRef.current = onUndo;
      }
      setHasPending(true);

      timeoutRef.current = setTimeout(() => {
        flush();
      }, delayMs);
    },
    [flush],
  );

  const undo = useCallback(() => {
    if (timeoutRef.current) {
      if (onUndoRef.current) {
        onUndoRef.current();
      }
      clearPending();
    }
  }, [clearPending]);


  useEffect(() => {
    return () => {
      // execute on unmount instead of dropping if it's still pending
      if (timeoutRef.current && pendingActionRef.current) {
        pendingActionRef.current();
        clearPending();
      }
    };
  }, [clearPending, flush]);

  return { executeWithUndo, undo, flush, hasPending };
}
