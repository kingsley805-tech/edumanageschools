import { useCallback, useEffect, useState } from "react";
import { Download, Package, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useModuleAccess } from "@/modules/lib/useModuleAccess";
import { ModuleAccessDenied } from "@/modules/lib/ModuleAccessDenied";
import { downloadCsv } from "@/modules/lib/exportCsv";
import { isMissingTableError, operationsSchemaSetupMessage } from "@/modules/lib/missingSchema";
import { OperationsSchemaSetupCard } from "@/modules/lib/OperationsSchemaSetupCard";
import { toast } from "sonner";

type ItemRow = {
  id: string;
  sku: string | null;
  name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  location: string | null;
  reorder_level: number | null;
};

export default function InventoryPage() {
  const { currentSchool } = useSchoolInfo();
  const schoolId = currentSchool?.id ?? null;
  const access = useModuleAccess("inventory");
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [unit, setUnit] = useState("pcs");
  const [location, setLocation] = useState("");
  const [reorder, setReorder] = useState("");
  const [schemaMissing, setSchemaMissing] = useState(false);

  const handleDbError = (error: { code?: string; message?: string; status?: number }) => {
    if (isMissingTableError(error)) {
      setSchemaMissing(true);
      toast.error(operationsSchemaSetupMessage());
      return true;
    }
    toast.error(error.message ?? "Request failed");
    return false;
  };

  const load = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("school_id", schoolId)
      .order("name");

    if (error) {
      handleDbError(error);
      return;
    }
    setSchemaMissing(false);
    setRows((data ?? []) as ItemRow[]);
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!schoolId || !name.trim()) {
      toast.error("Item name is required.");
      return;
    }
    const { error } = await supabase.from("inventory_items").insert({
      school_id: schoolId,
      sku: sku.trim() || null,
      name: name.trim(),
      category: category.trim() || null,
      quantity: Number(quantity) || 0,
      unit: unit.trim() || null,
      location: location.trim() || null,
      reorder_level: reorder ? Number(reorder) : null,
    });
    if (error) {
      handleDbError(error);
      return;
    }
    toast.success("Item added");
    setOpen(false);
    setName("");
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else void load();
  };

  if (!access.canView) return <ModuleAccessDenied label="Inventory" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Package className="h-6 w-6" />
            Inventory
          </h1>
          <p className="text-sm text-muted-foreground">Track school supplies, assets, and stock levels.</p>
        </div>
        <div className="flex gap-2">
          {access.canExport ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                downloadCsv(
                  "inventory.csv",
                  ["SKU", "Name", "Category", "Qty", "Unit", "Location", "Reorder"],
                  rows.map((r) => [r.sku, r.name, r.category, r.quantity, r.unit, r.location, r.reorder_level]),
                )
              }
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          ) : null}
          {access.canCreate ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add item
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add inventory item</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>SKU</Label>
                      <Input value={sku} onChange={(e) => setSku(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Name</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Category</Label>
                      <Input value={category} onChange={(e) => setCategory(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Location</Label>
                      <Input value={location} onChange={(e) => setLocation(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Quantity</Label>
                      <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Unit</Label>
                      <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Reorder at</Label>
                      <Input type="number" value={reorder} onChange={(e) => setReorder(e.target.value)} />
                    </div>
                  </div>
                  <Button onClick={() => void create()}>Save item</Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>

      {schemaMissing ? <OperationsSchemaSetupCard moduleLabel="Inventory" /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock items</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Location</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const low =
                  r.reorder_level != null && r.quantity <= r.reorder_level;
                return (
                  <TableRow key={r.id}>
                    <TableCell>{r.sku ?? "—"}</TableCell>
                    <TableCell className="font-medium">
                      {r.name}
                      {low ? (
                        <Badge variant="destructive" className="ml-2">
                          Low
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>{r.category ?? "—"}</TableCell>
                    <TableCell>
                      {r.quantity} {r.unit ?? ""}
                    </TableCell>
                    <TableCell>{r.location ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {access.canDelete ? (
                        <Button variant="ghost" size="icon" onClick={() => void remove(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
