import { useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InventoryFiltersBar } from "@/modules/inventory/components/InventoryFiltersBar";
import type { InventoryFilters, StockMovement } from "@/modules/inventory/lib/types";
import { ExportMenu } from "@/modules/lib/ExportMenu";

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
  const [viewMovement, setViewMovement] = useState<StockMovement | null>(null);
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
            <ExportMenu
              filename="stock-movements"
              title="Stock Movements"
              headers={["Date", "Item", "SKU", "Type", "Qty", "Prev", "Current", "Dept", "Source/Dest", "Remarks"]}
              rows={filtered.map((m) => [
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
              ])}
            />
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
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
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
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setViewMovement(m)} title="View movement audit">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!viewMovement} onOpenChange={(v) => !v && setViewMovement(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span>{viewMovement?.item_name}</span>
              {viewMovement?.transaction_type ? (
                <Badge className={TYPE_COLORS[viewMovement.transaction_type]}>
                  {TYPE_LABELS[viewMovement.transaction_type]}
                </Badge>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          {viewMovement ? (
            <dl className="grid gap-2.5 text-sm sm:grid-cols-2 py-2">
              {[
                ["SKU", viewMovement.item_sku],
                ["Transaction Type", TYPE_LABELS[viewMovement.transaction_type]],
                ["Quantity", viewMovement.quantity],
                ["Previous Stock", viewMovement.previous_stock],
                ["Current Stock", viewMovement.current_stock],
                ["Department", viewMovement.department],
                ["Source / Destination", viewMovement.source_destination],
                ["Timestamp", new Date(viewMovement.created_at).toLocaleString()],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-md border bg-muted/20 p-2">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="font-medium mt-0.5">{String(v ?? "—")}</dd>
                </div>
              ))}
              {viewMovement.remarks ? (
                <div className="sm:col-span-2 rounded-md border bg-muted/20 p-2">
                  <dt className="text-xs text-muted-foreground">Remarks</dt>
                  <dd className="text-sm mt-0.5">{viewMovement.remarks}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setViewMovement(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
