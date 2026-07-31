import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Inbox,
  Search,
  X,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc";

export type DataTableColumn<Row> = {
  /** Stable key; also the default sort key */
  id: string;
  header: React.ReactNode;
  /** Cell renderer. Receives the row and its index within the current page. */
  cell: (row: Row, index: number) => React.ReactNode;
  /** Right-aligned tabular figures — money, counts, percentages */
  numeric?: boolean;
  /** Right-aligned, non-wrapping action column */
  actions?: boolean;
  /** Enable sorting. Provide a value extractor, or `true` to skip sorting. */
  sortValue?: (row: Row) => string | number | Date | null | undefined;
  /** Contribute to the search index */
  searchValue?: (row: Row) => string | number | null | undefined;
  /** Hide below the md breakpoint */
  hideOnMobile?: boolean;
  headClassName?: string;
  cellClassName?: string;
  width?: string;
};

export type DataTableProps<Row> = {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  /** Stable React key per row */
  rowKey: (row: Row, index: number) => string;
  loading?: boolean;
  /** Rows of skeleton to show while loading */
  loadingRows?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  /** Show the search input. Columns need `searchValue` to be searchable. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Rows per page. Pass 0 to disable pagination. */
  pageSize?: number;
  pageSizeOptions?: number[];
  /** Initial sort */
  defaultSort?: { columnId: string; direction: SortDirection };
  /** Extra controls rendered next to the search field */
  toolbar?: React.ReactNode;
  onRowClick?: (row: Row) => void;
  /** Constrain height so the sticky header engages */
  maxHeight?: string | number;
  compact?: boolean;
  /** Alternating row tint. Off by default — plain rows with hairline dividers. */
  zebra?: boolean;
  className?: string;
};

function compareValues(
  a: string | number | Date | null | undefined,
  b: string | number | Date | null | undefined,
) {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  if (a instanceof Date || b instanceof Date) {
    return new Date(a as Date).getTime() - new Date(b as Date).getTime();
  }
  if (typeof a === "number" && typeof b === "number") return a - b;

  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Enterprise data table: sortable columns, search, pagination, status-aware
 * alignment, loading skeletons and an empty state.
 *
 * Purely presentational — it sorts, filters and paginates whatever array it
 * is handed. It performs no fetching and holds no business logic.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  loading = false,
  loadingRows = 6,
  emptyTitle = "No records found",
  emptyDescription,
  emptyAction,
  searchable = true,
  searchPlaceholder = "Search…",
  pageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  defaultSort,
  toolbar,
  onRowClick,
  maxHeight,
  compact = false,
  zebra = false,
  className,
}: DataTableProps<Row>) {
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(pageSize);
  const [sort, setSort] = React.useState<
    { columnId: string; direction: SortDirection } | null
  >(defaultSort ?? null);

  const searchableColumns = React.useMemo(
    () => columns.filter((column) => column.searchValue),
    [columns],
  );
  const showSearch = searchable && searchableColumns.length > 0;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      searchableColumns.some((column) => {
        const value = column.searchValue?.(row);
        return value != null && String(value).toLowerCase().includes(q);
      }),
    );
  }, [rows, query, searchableColumns]);

  const sorted = React.useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((item) => item.id === sort.columnId);
    if (!column?.sortValue) return filtered;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort(
      (a, b) => compareValues(column.sortValue!(a), column.sortValue!(b)) * factor,
    );
  }, [filtered, sort, columns]);

  const paginated = pageSize > 0;
  const pageCount = paginated ? Math.max(1, Math.ceil(sorted.length / size)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const visible = paginated
    ? sorted.slice(safePage * size, safePage * size + size)
    : sorted;

  // Reset to the first page whenever the result set changes shape.
  React.useEffect(() => {
    setPage(0);
  }, [query, size, rows]);

  const toggleSort = (column: DataTableColumn<Row>) => {
    if (!column.sortValue) return;
    setSort((current) => {
      if (current?.columnId !== column.id) {
        return { columnId: column.id, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { columnId: column.id, direction: "desc" };
      }
      return null;
    });
  };

  const ariaSortFor = (column: DataTableColumn<Row>) => {
    if (!column.sortValue) return undefined;
    if (sort?.columnId !== column.id) return "none" as const;
    return sort.direction === "asc"
      ? ("ascending" as const)
      : ("descending" as const);
  };

  const rangeStart = sorted.length === 0 ? 0 : safePage * size + 1;
  const rangeEnd = Math.min(sorted.length, safePage * size + size);

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      {showSearch || toolbar ? (
        <div className="flex flex-wrap items-center gap-2">
          {showSearch ? (
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-9 w-full rounded-[var(--radius-control)] border border-input bg-background pl-9 pr-8 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}
          {toolbar ? (
            <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          ) : null}
        </div>
      ) : null}

      <Table
        maxHeight={maxHeight}
        zebra={zebra}
        className={cn(compact && "data-table-compact")}
      >
        <TableHeader>
          <TableRow>
            {columns.map((column) => {
              const sortable = Boolean(column.sortValue);
              const active = sort?.columnId === column.id;
              return (
                <TableHead
                  key={column.id}
                  numeric={column.numeric}
                  actions={column.actions}
                  aria-sort={ariaSortFor(column)}
                  tabIndex={sortable ? 0 : undefined}
                  style={column.width ? { width: column.width } : undefined}
                  onClick={sortable ? () => toggleSort(column) : undefined}
                  onKeyDown={
                    sortable
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleSort(column);
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    column.hideOnMobile && "hidden md:table-cell",
                    column.headClassName,
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5",
                      (column.numeric || column.actions) && "flex-row-reverse",
                    )}
                  >
                    {column.header}
                    {sortable ? (
                      active ? (
                        sort!.direction === "asc" ? (
                          <ArrowUp aria-hidden className="h-3 w-3" />
                        ) : (
                          <ArrowDown aria-hidden className="h-3 w-3" />
                        )
                      ) : (
                        <ChevronsUpDown
                          aria-hidden
                          className="h-3 w-3 opacity-40"
                        />
                      )
                    ) : null}
                  </span>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>

        <TableBody>
          {loading ? (
            Array.from({ length: loadingRows }).map((_, rowIndex) => (
              <TableRow key={`skeleton-${rowIndex}`}>
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={cn(column.hideOnMobile && "hidden md:table-cell")}
                  >
                    <span
                      className="table-skeleton-bar block"
                      style={{ width: `${55 + ((rowIndex * 13) % 35)}%` }}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : visible.length === 0 ? (
            <TableRow className="table-empty">
              <TableCell colSpan={columns.length}>
                <div className="flex flex-col items-center gap-2">
                  <Inbox aria-hidden className="h-7 w-7 opacity-40" />
                  <p className="text-sm font-medium text-foreground">
                    {query.trim() ? "No matching records" : emptyTitle}
                  </p>
                  {query.trim() ? (
                    <p className="text-xs">
                      Nothing matches “{query.trim()}”. Try a different search.
                    </p>
                  ) : emptyDescription ? (
                    <p className="text-xs">{emptyDescription}</p>
                  ) : null}
                  {!query.trim() && emptyAction ? (
                    <div className="mt-1">{emptyAction}</div>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            visible.map((row, index) => (
              <TableRow
                key={rowKey(row, index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && "cursor-pointer")}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    numeric={column.numeric}
                    actions={column.actions}
                    className={cn(
                      column.hideOnMobile && "hidden md:table-cell",
                      column.cellClassName,
                    )}
                  >
                    {column.cell(row, index)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {paginated && !loading && sorted.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>
              {rangeStart}–{rangeEnd} of {sorted.length}
            </span>
            <Select
              value={String(size)}
              onValueChange={(value) => setSize(Number(value))}
            >
              <SelectTrigger className="h-8 w-[72px] text-xs" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="hidden sm:inline">per page</span>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Page {safePage + 1} of {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={safePage === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={safePage >= pageCount - 1}
              onClick={() =>
                setPage((current) => Math.min(pageCount - 1, current + 1))
              }
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Soft status pill. Pass `dot` for a leading indicator dot. */
export function StatusBadge({
  tone = "neutral",
  dot = false,
  children,
  className,
}: {
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "table-status",
        `table-status-${tone}`,
        dot && "table-status-dot",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Two-line identity cell — bold primary over a dim secondary line.
 * Matches the "37 Military Hospital / NA" pattern.
 */
export function CellStack({
  primary,
  secondary,
  className,
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("cell-stack", className)}>
      <span className="cell-primary">{primary}</span>
      {secondary != null && secondary !== "" ? (
        <span className="cell-secondary">{secondary}</span>
      ) : null}
    </div>
  );
}

/**
 * Dim-icon-prefixed value. Renders an em-dash placeholder when the value
 * is empty, so columns stay visually aligned.
 */
export function CellWithIcon({
  icon: Icon,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  const empty =
    children === null || children === undefined || children === "";
  if (empty) return <span className="cell-empty">—</span>;
  return (
    <span className={cn("cell-with-icon", className)}>
      <Icon className="cell-icon" aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Plain dim value — for low-emphasis columns like Type. */
export function CellMuted({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const empty =
    children === null || children === undefined || children === "";
  if (empty) return <span className="cell-empty">—</span>;
  return <span className={cn("cell-muted", className)}>{children}</span>;
}

/** Right-aligned cluster for row action buttons. */
export function CellActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("cell-actions", className)}>{children}</span>;
}

/**
 * Dim ghost icon button for row actions — dim at rest, full contrast on
 * hover. `tone="danger"` turns it red on hover (delete, revoke, etc).
 */
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    tone?: "default" | "danger";
    label: string;
  }
>(({ tone = "default", label, className, children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label={label}
    title={label}
    className={cn("btn-dim", tone === "danger" && "btn-dim-danger", className)}
    {...props}
  >
    {children}
  </button>
));
IconButton.displayName = "IconButton";
