import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Enterprise data table primitives.
 *
 * The outer wrapper provides the rounded shell, horizontal scroll on narrow
 * viewports, and the containing block that sticky headers stick to. Visual
 * treatment (zebra rows, hover, sticky header, numeric alignment) lives in
 * index.css under `.data-table` so every existing table in the app picks it
 * up without being rewritten.
 *
 * Opt-outs, per table:
 *   <Table bare>              no shell border/radius (table already in a card)
 *   <Table stickyHeader={false}>
 *   <Table zebra={false}>
 *
 * Column alignment is data-driven — pass `numeric` to a TableHead/TableCell
 * for right-aligned tabular figures, or `actions` for a right-aligned,
 * non-wrapping action column.
 */

type TableProps = React.HTMLAttributes<HTMLTableElement> & {
  /** Drop the outer border + radius (use when the table already sits in a card) */
  bare?: boolean;
  stickyHeader?: boolean;
  /** Alternating row tint. Off by default — plain rows with hairline dividers. */
  zebra?: boolean;
  /** Max height for the scroll container; enables vertical stickiness */
  maxHeight?: string | number;
  containerClassName?: string;
};

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  (
    {
      className,
      bare = false,
      stickyHeader = true,
      zebra = false,
      maxHeight,
      containerClassName,
      ...props
    },
    ref,
  ) => (
    <div
      className={cn(
        "data-table-shell relative w-full overflow-auto",
        bare && "data-table-shell-bare",
        containerClassName,
      )}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table
        ref={ref}
        data-sticky-header={stickyHeader ? "true" : undefined}
        data-zebra={zebra ? "true" : undefined}
        className={cn("data-table w-full caption-bottom", className)}
        {...props}
      />
    </div>
  ),
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn(className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn(className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot ref={ref} className={cn("font-medium", className)} {...props} />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr ref={ref} className={cn(className)} {...props} />
));
TableRow.displayName = "TableRow";

type CellAlignProps = {
  /** Right-align with tabular figures — use for money, counts, percentages */
  numeric?: boolean;
  /** Right-aligned, non-wrapping column for row actions */
  actions?: boolean;
};

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & CellAlignProps
>(({ className, numeric, actions, ...props }, ref) => (
  <th
    ref={ref}
    data-numeric={numeric ? "true" : undefined}
    data-actions={actions ? "true" : undefined}
    className={cn(className)}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & CellAlignProps
>(({ className, numeric, actions, ...props }, ref) => (
  <td
    ref={ref}
    data-numeric={numeric ? "true" : undefined}
    data-actions={actions ? "true" : undefined}
    className={cn(className)}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-3 text-xs text-muted-foreground", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
