import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InventoryFiltersBar } from "@/modules/inventory/components/InventoryFiltersBar";
import type { InventoryFilters, StockMovement } from "@/modules/inventory/lib/types";
import { downloadCsv } from "@/modules/lib/exportCsv";

type Props = {
  movements: StockMovement[];
  canExport?: boolean;
};

const TYPE_LABELS: Record<StockMovement["transaction_type"], string> = {
  stock_in: "Stock In",
  stock_out: "Stock Out",
  transfer: "Transfer",
  return: "Return",
  adjustment: "Adjustment",
};

const TYPE_COLORS: Record<StockMovement["transaction_type"], string> = {
  stock_in: "bg-emerald-600/90",
  stock_out: "bg-red-600/90",
  transfer: "bg-blue-600/90",
  return: "bg-cyan-600/90",
  adjustment: "bg-amber-600/90",
};

export function InventoryStockMovementPanel({ movements, canExport }: Props) {
  const [filters, setFilters] = useState<InventoryFilters>({
    search: "",
    category: "",
    supplierId: "",
    department: "",
    stockStatus: "",
    assetStatus: "",
    dateFrom: "",
    dateTo: "",
  });

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return movements.filter((m) => {
      if (q) {
        const hay = [m.item_name, m.item_sku, m.department, m.source_destination, m.remarks]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.department && m.department !== filters.department) return false;
      if (filters.dateFrom && m.created_at.slice(0, 10) < filters.dateFrom) return false;
      if (filters.dateTo && m.created_at.slice(0, 10) > filters.dateTo) return false;
      return true;
    });
  }, [movements, filters]);

  return (
    <div className="space-y-4">
      <InventoryFiltersBar
        filters={filters}
        onChange={setFilters}
        categories={[]}
        suppliers={[]}
        showDateRange
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Stock Movement</CardTitle>
            <CardDescription>{filtered.length} transaction(s) — audit trail</CardDescription>
          </div>
          {canExport !== false ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                downloadCsv(
                  "stock-movements.csv",
                  ["Date", "Item", "SKU", "Type", "Qty", "Prev", "Current", "Dept", "Source/Dest", "Remarks"],
                  filtered.map((m) => [
                    new Date(m.created_at).toLocaleString(),
                    m.item_name,
                    m.item_sku,
                    TYPE_LABELS[m.transaction_type],
                    m.quantity,
                    m.previous_stock,
                    m.current_stock,
                    m.department,
                    m.source_destination,
                    m.remarks,
                  ]),
                )
              }
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Prev → Current</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Source/Dest</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No stock movements recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(m.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium">{m.item_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={TYPE_COLORS[m.transaction_type]}>
                        {TYPE_LABELS[m.transaction_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>{m.quantity}</TableCell>
                    <TableCell className="tabular-nums">
                      {m.previous_stock} → {m.current_stock}
                    </TableCell>
                    <TableCell>{m.department ?? "—"}</TableCell>
                    <TableCell>{m.source_destination ?? "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{m.remarks ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
