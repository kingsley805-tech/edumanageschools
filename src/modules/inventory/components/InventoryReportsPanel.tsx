import { useMemo } from "react";
import { BarChart3, Download, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/charts/ChartCard";
import { AnimatedBarChart } from "@/components/charts/AnimatedBarChart";
import { downloadCsv } from "@/modules/lib/exportCsv";
import { formatMoney } from "@/lib/currency";
import type {
  InventoryAsset,
  InventoryDashboardStats,
  InventoryIssuance,
  InventoryItem,
  PurchaseOrder,
  StockMovement,
} from "@/modules/inventory/lib/types";

type Props = {
  stats: InventoryDashboardStats;
  items: InventoryItem[];
  assets: InventoryAsset[];
  movements: StockMovement[];
  orders: PurchaseOrder[];
  issuances: InventoryIssuance[];
  currency?: string | null;
};

export function InventoryReportsPanel({
  stats,
  items,
  assets,
  movements,
  orders,
  issuances,
  currency,
}: Props) {
  const money = (v: number) => formatMoney(v, currency);

  const categoryValue = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const cat = item.category ?? "Uncategorized";
      map.set(cat, (map.get(cat) ?? 0) + (item.stock_value ?? 0));
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [items]);

  const movementTrend = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const m of movements) {
      const month = m.created_at.slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([label, count]) => ({ label, transactions: count }));
  }, [movements]);

  const deptUsage = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of issuances.filter((x) => x.status !== "returned")) {
      const dept = i.class_or_department ?? "General";
      map.set(dept, (map.get(dept) ?? 0) + i.quantity);
    }
    return [...map.entries()]
      .map(([label, qty]) => ({ label, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);
  }, [issuances]);

  const lowStock = items.filter((i) => i.item_status === "low_stock");
  const outOfStock = items.filter((i) => i.item_status === "out_of_stock");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            downloadCsv(
              "current-inventory.csv",
              ["SKU", "Name", "Category", "Qty", "Unit Cost", "Value", "Status"],
              items.map((i) => [i.sku, i.name, i.category, i.quantity, i.unit_cost, i.stock_value, i.item_status]),
            )
          }
        >
          <Download className="h-4 w-4" />
          Current Inventory
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            downloadCsv(
              "low-stock-report.csv",
              ["SKU", "Name", "Qty", "Reorder"],
              lowStock.map((i) => [i.sku, i.name, i.quantity, i.reorder_level]),
            )
          }
        >
          <Download className="h-4 w-4" />
          Low Stock
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            downloadCsv(
              "asset-register.csv",
              ["Code", "Name", "Category", "Purchase", "Current", "Condition", "Status"],
              assets.map((a) => [a.asset_code, a.name, a.category, a.purchase_cost, a.current_value, a.asset_condition, a.asset_status]),
            )
          }
        >
          <Download className="h-4 w-4" />
          Asset Register
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            downloadCsv(
              "stock-movements.csv",
              ["Date", "Item", "Type", "Qty", "Prev", "Current"],
              movements.map((m) => [m.created_at, m.item_name, m.transaction_type, m.quantity, m.previous_stock, m.current_stock]),
            )
          }
        >
          <Download className="h-4 w-4" />
          Stock Movements
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            downloadCsv(
              "purchase-history.csv",
              ["PO#", "Supplier", "Date", "Total", "Payment", "Delivery"],
              orders.map((o) => [o.po_number, o.supplier_name, o.purchase_date, o.total_cost, o.payment_status, o.delivery_status]),
            )
          }
        >
          <Download className="h-4 w-4" />
          Purchase History
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            downloadCsv(
              "issuance-report.csv",
              ["Item", "Recipient", "Qty", "Date", "Status"],
              issuances.map((i) => [i.item_name, i.recipient_name, i.quantity, i.issue_date, i.status]),
            )
          }
        >
          <Download className="h-4 w-4" />
          Issuance Report
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Inventory valuation</p>
          <p className="text-2xl font-bold">{money(stats.total_inventory_value)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Low stock items</p>
          <p className="text-2xl font-bold text-amber-600">{stats.low_stock_items}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Out of stock</p>
          <p className="text-2xl font-bold text-red-600">{stats.out_of_stock_items}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Active assets</p>
          <p className="text-2xl font-bold">{stats.total_assets}</p>
        </div>
      </div>

      {categoryValue.length > 0 ? (
        <ChartCard
          title="Inventory Valuation by Category"
          description="Stock value distribution"
          icon={<Package className="h-4 w-4" />}
          className="dark:bg-[#0b0f0d]"
        >
          <AnimatedBarChart
            data={categoryValue}
            categoryKey="label"
            series={[{ key: "value", label: "Value", color: "hsl(var(--chart-1))" }]}
            height={240}
            showLegend={false}
            className="dark:bg-[#0b0f0d]"
          />
        </ChartCard>
      ) : null}

      {movementTrend.length > 0 ? (
        <ChartCard
          title="Stock Movement Trend"
          description="Transactions per month"
          icon={<BarChart3 className="h-4 w-4" />}
          className="dark:bg-[#0b0f0d]"
        >
          <AnimatedBarChart
            data={movementTrend}
            categoryKey="label"
            series={[{ key: "transactions", label: "Transactions", color: "hsl(var(--chart-2))" }]}
            height={220}
            showLegend={false}
            className="dark:bg-[#0b0f0d]"
          />
        </ChartCard>
      ) : null}

      {deptUsage.length > 0 ? (
        <ChartCard
          title="Department Usage"
          description="Outstanding issued quantities by department"
          icon={<BarChart3 className="h-4 w-4" />}
          className="dark:bg-[#0b0f0d]"
        >
          <AnimatedBarChart
            data={deptUsage}
            categoryKey="label"
            series={[{ key: "qty", label: "Quantity", color: "hsl(var(--chart-3))" }]}
            height={220}
            showLegend={false}
            className="dark:bg-[#0b0f0d]"
          />
        </ChartCard>
      ) : null}

      {(lowStock.length > 0 || outOfStock.length > 0) ? (
        <div className="grid gap-4 md:grid-cols-2">
          {lowStock.length > 0 ? (
            <div className="rounded-xl border p-4">
              <p className="mb-2 font-medium">Low Stock Report</p>
              <ul className="space-y-1 text-sm">
                {lowStock.slice(0, 10).map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <span>{i.name}</span>
                    <span className="text-amber-600">{i.quantity} / {i.reorder_level}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {outOfStock.length > 0 ? (
            <div className="rounded-xl border p-4">
              <p className="mb-2 font-medium">Out of Stock Report</p>
              <ul className="space-y-1 text-sm">
                {outOfStock.slice(0, 10).map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <span>{i.name}</span>
                    <span className="text-red-600">0</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
