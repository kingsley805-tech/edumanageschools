import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import type { InventoryFilters, InventorySupplier } from "@/modules/inventory/lib/types";

type Props = {
  filters: InventoryFilters;
  onChange: (next: InventoryFilters) => void;
  categories: string[];
  suppliers: InventorySupplier[];
  showStockStatus?: boolean;
  showAssetStatus?: boolean;
  showDateRange?: boolean;
};

export function InventoryFiltersBar({
  filters,
  onChange,
  categories,
  suppliers,
  showStockStatus,
  showAssetStatus,
  showDateRange,
}: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/60 p-4 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search name, SKU, barcode…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>
      {categories.length > 0 ? (
        <Select
          value={filters.category || "all"}
          onValueChange={(v) => onChange({ ...filters, category: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-full lg:w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {suppliers.length > 0 ? (
        <Select
          value={filters.supplierId || "all"}
          onValueChange={(v) => onChange({ ...filters, supplierId: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue placeholder="Supplier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {showStockStatus ? (
        <Select
          value={filters.stockStatus || "all"}
          onValueChange={(v) => onChange({ ...filters, stockStatus: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-full lg:w-[150px]">
            <SelectValue placeholder="Stock status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stock</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="low_stock">Low stock</SelectItem>
            <SelectItem value="out_of_stock">Out of stock</SelectItem>
            <SelectItem value="discontinued">Discontinued</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
      {showAssetStatus ? (
        <Select
          value={filters.assetStatus || "all"}
          onValueChange={(v) => onChange({ ...filters, assetStatus: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-full lg:w-[160px]">
            <SelectValue placeholder="Asset status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assets</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="maintenance">Under maintenance</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
      {showDateRange ? (
        <>
          <Input
            type="date"
            className="w-full lg:w-[150px]"
            value={filters.dateFrom}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
          />
          <Input
            type="date"
            className="w-full lg:w-[150px]"
            value={filters.dateTo}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
          />
        </>
      ) : null}
    </div>
  );
}
