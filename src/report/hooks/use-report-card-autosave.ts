import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_DELAY_MS = 800;

type Options = {
  /** When false, scheduleAutosave is a no-op */
  enabled?: boolean;
  delayMs?: number;
  onSave: () => Promise<void>;
};

/**
 * Debounced background save for report card forms.
 * Coalesces rapid edits (table cells, remarks, etc.) into a single save.
 */
export function useReportCardAutosave({ enabled = true, delayMs = DEFAULT_DELAY_MS, onSave }: Options) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [scheduled, setScheduled] = useState(false);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const runSave = useCallback(async () => {
    if (!enabled) return;
    setSaving(true);
    try {
      await onSaveRef.current();
      setLastSaved(new Date());
    } finally {
      setSaving(false);
    }
  }, [enabled]);

  const scheduleAutosave = useCallback(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setScheduled(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void runSave().finally(() => setScheduled(false));
    }, delayMs);
  }, [enabled, delayMs, runSave]);

  const flushAutosave = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      setScheduled(false);
      await runSave();
    }
  }, [runSave]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    scheduleAutosave,
    flushAutosave,
    lastSaved,
    saving,
    autosavePending: scheduled || saving,
  };
}
