import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Box,
  LayoutGrid,
  Package,
  RefreshCw,
  ScanLine,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useSchoolCurrency } from "@/hooks/useSchoolCurrency";
import { useModuleAccess } from "@/modules/lib/useModuleAccess";
import { ModuleAccessDenied } from "@/modules/lib/ModuleAccessDenied";
import { isMissingTableError, operationsSchemaSetupMessage } from "@/modules/lib/missingSchema";
import { InventorySchemaSetupCard } from "@/modules/inventory/components/InventorySchemaSetupCard";
import { InventoryDashboardPanel } from "@/modules/inventory/components/InventoryDashboardPanel";
import { InventoryItemsPanel } from "@/modules/inventory/components/InventoryItemsPanel";
import { InventoryAssetsPanel } from "@/modules/inventory/components/InventoryAssetsPanel";
import { InventoryStockMovementPanel } from "@/modules/inventory/components/InventoryStockMovementPanel";
import { InventoryPurchasesPanel } from "@/modules/inventory/components/InventoryPurchasesPanel";
import { InventorySuppliersPanel } from "@/modules/inventory/components/InventorySuppliersPanel";
import { InventoryIssuancePanel } from "@/modules/inventory/components/InventoryIssuancePanel";
import { InventoryReportsPanel } from "@/modules/inventory/components/InventoryReportsPanel";
import { InventoryBarcodeLookup } from "@/modules/inventory/components/InventoryBarcodeLookup";
import {
  fetchAssets,
  fetchClassOptions,
  fetchInventoryDashboardStats,
  fetchInventoryItems,
  fetchIssuances,
  fetchPurchaseOrders,
  fetchStockMovements,
  fetchSuppliers,
  fetchTeacherOptions,
} from "@/modules/inventory/lib/api";
import {
  checkInventorySchema,
  inventorySchemaReady,
  type InventorySchemaStatus,
} from "@/modules/inventory/lib/schema";
import type {
  InventoryAsset,
  InventoryDashboardStats,
  InventoryIssuance,
  InventoryItem,
  InventorySupplier,
  PurchaseOrder,
  StockMovement,
} from "@/modules/inventory/lib/types";
import { toast } from "sonner";

const EMPTY_STATS: InventoryDashboardStats = {
  total_items: 0,
  total_assets: 0,
  available_stock: 0,
  low_stock_items: 0,
  out_of_stock_items: 0,
  recently_added: 0,
  total_inventory_value: 0,
  issued_today: 0,
  returned_today: 0,
  pending_purchase_orders: 0,
  damaged_items: 0,
  disposed_items: 0,
};

export default function InventoryPage() {
  const { currentSchool } = useSchoolInfo();
  const schoolId = currentSchool?.id ?? null;
  const { currency, format } = useSchoolCurrency();
  const access = useModuleAccess("inventory");

  const [schemaStatus, setSchemaStatus] = useState<InventorySchemaStatus | null>(null);
  const [schemaChecking, setSchemaChecking] = useState(false);
  const [stats, setStats] = useState<InventoryDashboardStats>(EMPTY_STATS);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<InventorySupplier[]>([]);
  const [assets, setAssets] = useState<InventoryAsset[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [issuances, setIssuances] = useState<InventoryIssuance[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);

  const accessProps = useMemo(
    () => ({
      canCreate: access.canCreate,
      canEdit: access.canEdit,
      canDelete: access.canDelete,
      canExport: access.canExport,
    }),
    [access.canCreate, access.canEdit, access.canDelete, access.canExport],
  );

  const handleDbError = (error: { code?: string; message?: string; status?: number }) => {
    if (isMissingTableError(error)) {
      toast.error(operationsSchemaSetupMessage());
      return true;
    }
    toast.error(error.message ?? "Request failed");
    return false;
  };

  const loadAll = useCallback(async () => {
    if (!schoolId) return;
    setSchemaChecking(true);
    try {
      const status = await checkInventorySchema(schoolId);
      setSchemaStatus(status);

      if (!status.items) {
        setItems([]);
        setSuppliers([]);
        setAssets([]);
        setMovements([]);
        setOrders([]);
        setIssuances([]);
        setStats(EMPTY_STATS);
        return;
      }

      const itemRows = await fetchInventoryItems(schoolId);
      setItems(itemRows);

      const [teacherRows, classRows] = await Promise.all([
        fetchTeacherOptions(schoolId).catch(() => []),
        fetchClassOptions(schoolId).catch(() => []),
      ]);
      setTeachers(teacherRows);
      setClasses(classRows);

      if (status.suppliers) {
        setSuppliers(await fetchSuppliers(schoolId));
      } else {
        setSuppliers([]);
      }

      if (status.assets) {
        setAssets(await fetchAssets(schoolId));
      } else {
        setAssets([]);
      }

      if (status.movements) {
        setMovements(await fetchStockMovements(schoolId));
      } else {
        setMovements([]);
      }

      if (status.purchases) {
        setOrders(await fetchPurchaseOrders(schoolId));
      } else {
        setOrders([]);
      }

      if (status.issuances) {
        setIssuances(await fetchIssuances(schoolId));
      } else {
        setIssuances([]);
      }

      if (status.rpcStats) {
        try {
          setStats(await fetchInventoryDashboardStats(schoolId));
        } catch {
          setStats({
            ...EMPTY_STATS,
            total_items: itemRows.length,
            available_stock: itemRows.reduce((s, i) => s + i.quantity, 0),
            low_stock_items: itemRows.filter((i) => i.item_status === "low_stock").length,
            out_of_stock_items: itemRows.filter((i) => i.item_status === "out_of_stock").length,
            total_inventory_value: itemRows.reduce((s, i) => s + (i.stock_value ?? 0), 0),
          });
        }
      } else {
        setStats({
          ...EMPTY_STATS,
          total_items: itemRows.length,
          available_stock: itemRows.reduce((s, i) => s + i.quantity, 0),
          low_stock_items: itemRows.filter((i) => i.item_status === "low_stock").length,
          out_of_stock_items: itemRows.filter((i) => i.item_status === "out_of_stock").length,
          total_inventory_value: itemRows.reduce((s, i) => s + (i.stock_value ?? 0), 0),
        });
      }
    } catch (e) {
      handleDbError(e as { message?: string; code?: string });
    } finally {
      setSchemaChecking(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const schemaReady = schemaStatus ? inventorySchemaReady(schemaStatus) : false;
  const fmt = useMemo(
    () => (v: number) => format(v, currency, { maximumFractionDigits: 0 }),
    [format, currency],
  );

  if (!access.canView) return <ModuleAccessDenied label="Inventory Management" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Package className="h-6 w-6" />
            Inventory Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Stock, assets, purchases, issuances, and analytics for school supplies
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadAll()}
          disabled={schemaChecking}
          className="gap-1.5"
        >
          <RefreshCw className={`h-4 w-4 ${schemaChecking ? "animate-spin" : ""}`} />
          {schemaChecking ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {schemaStatus && !schemaReady ? (
        <InventorySchemaSetupCard
          status={schemaStatus}
          checking={schemaChecking}
          onRecheck={() => void loadAll()}
        />
      ) : null}

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard" className="gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="items" className="gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Items
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-1.5">
            <Box className="h-3.5 w-3.5" />
            Assets
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-1.5">
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Stock Movement
          </TabsTrigger>
          <TabsTrigger value="purchases" className="gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5" />
            Purchases
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-1.5">
            <Truck className="h-3.5 w-3.5" />
            Suppliers
          </TabsTrigger>
          <TabsTrigger value="issuance" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Issuance
          </TabsTrigger>
          <TabsTrigger value="lookup" className="gap-1.5">
            <ScanLine className="h-3.5 w-3.5" />
            Barcode
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <InventoryDashboardPanel stats={stats} currency={currency} formatCurrency={fmt} />
        </TabsContent>

        <TabsContent value="items">
          <InventoryItemsPanel
            items={items}
            suppliers={suppliers}
            schoolId={schoolId}
            access={accessProps}
            currency={currency}
            onRefresh={() => void loadAll()}
          />
        </TabsContent>

        <TabsContent value="assets">
          <InventoryAssetsPanel
            assets={assets}
            schoolId={schoolId}
            access={accessProps}
            currency={currency}
            teachers={teachers}
            classes={classes}
            onRefresh={() => void loadAll()}
          />
        </TabsContent>

        <TabsContent value="movements">
          <InventoryStockMovementPanel movements={movements} canExport={access.canExport} />
        </TabsContent>

        <TabsContent value="purchases">
          <InventoryPurchasesPanel
            orders={orders}
            suppliers={suppliers}
            items={items}
            schoolId={schoolId}
            access={accessProps}
            currency={currency}
            onRefresh={() => void loadAll()}
          />
        </TabsContent>

        <TabsContent value="suppliers">
          <InventorySuppliersPanel
            suppliers={suppliers}
            schoolId={schoolId}
            access={accessProps}
            onRefresh={() => void loadAll()}
          />
        </TabsContent>

        <TabsContent value="issuance">
          <InventoryIssuancePanel
            issuances={issuances}
            items={items}
            schoolId={schoolId}
            access={accessProps}
            onRefresh={() => void loadAll()}
          />
        </TabsContent>

        <TabsContent value="lookup">
          <InventoryBarcodeLookup schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="reports">
          <InventoryReportsPanel
            stats={stats}
            items={items}
            assets={assets}
            movements={movements}
            orders={orders}
            issuances={issuances}
            currency={currency}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
