import { useCallback, useEffect, useMemo, useState } from "react";

export type SelectableChild = {
  id: string;
  class_id?: string | null;
  [key: string]: unknown;
};

function storageKey(userId: string) {
  return `parent.selectedChild.${userId}`;
}

/**
 * Persists which linked child a parent is viewing across the portal.
 * Never mixes children — callers must filter all queries by selectedChild.id.
 */
export function useSelectedChild<T extends SelectableChild>(
  userId: string | undefined,
  children: T[],
) {
  const [selectedChildId, setSelectedChildIdState] = useState<string>("");

  useEffect(() => {
    if (!userId || children.length === 0) {
      setSelectedChildIdState("");
      return;
    }
    const stored = localStorage.getItem(storageKey(userId));
    const valid = stored && children.some((c) => c.id === stored);
    setSelectedChildIdState(valid ? stored! : children[0].id);
  }, [userId, children]);

  const setSelectedChildId = useCallback(
    (id: string) => {
      setSelectedChildIdState(id);
      if (userId) localStorage.setItem(storageKey(userId), id);
    },
    [userId],
  );

  const selectedChild = useMemo(
    () => children.find((c) => c.id === selectedChildId) ?? children[0] ?? null,
    [children, selectedChildId],
  );

  return {
    selectedChildId: selectedChild?.id ?? "",
    selectedChild,
    setSelectedChildId,
  };
}
