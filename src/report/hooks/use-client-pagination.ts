import { useEffect, useMemo, useState } from "react";

const PAGE_SIZES = [10, 25, 50, 100] as const;

export type PageSize = (typeof PAGE_SIZES)[number];

export function useClientPagination<T>(
  items: T[],
  options?: { pageSize?: number; resetKey?: string },
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(options?.pageSize ?? 10);

  useEffect(() => {
    setPage(1);
  }, [options?.resetKey, pageSize, items.length]);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const slice = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return {
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    total,
    totalPages,
    slice,
    from,
    to,
    pageSizes: PAGE_SIZES,
  };
}
