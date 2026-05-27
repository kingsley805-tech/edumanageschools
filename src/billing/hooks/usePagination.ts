import { useState, useMemo } from "react";

export function usePagination<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safeP = Math.min(page, totalPages);

  const paged = useMemo(
    () => items.slice((safeP - 1) * pageSize, safeP * pageSize),
    [items, safeP, pageSize]
  );

  return { page: safeP, totalPages, paged, setPage };
}
