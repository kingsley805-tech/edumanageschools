import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Eye,
  ImagePlus,
  Loader2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { formatMoney } from "@/lib/currency";
import { ModuleAccessDenied } from "@/modules/lib/ModuleAccessDenied";
import { OperationsSchemaSetupCard } from "@/modules/lib/OperationsSchemaSetupCard";
import { isMissingTableError } from "@/modules/lib/missingSchema";
import { useModuleAccess } from "@/modules/lib/useModuleAccess";
import { uploadShopProductImage } from "@/modules/shop/lib/uploadProductImage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ProductRow = {
  id: string;
  school_id: string;
  name: string;
  sku: string | null;
  product_type: string;
  description: string | null;
  price: number;
  cost: number;
  stock_qty: number;
  reorder_level: number;
  image_url: string | null;
  is_digital: boolean;
  status: string;
  is_archived: boolean;
};

const TYPE_OPTIONS = [
  { value: "uniform", label: "Uniform" },
  { value: "book", label: "Book" },
  { value: "stationery", label: "Stationery" },
  { value: "sports", label: "Sports" },
  { value: "accessory", label: "Accessory" },
  { value: "digital", label: "Digital" },
  { value: "general", label: "General" },
] as const;

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

const SKU_PREFIX: Record<string, string> = {
  uniform: "UNI",
  book: "BOK",
  stationery: "STA",
  sports: "SPO",
  accessory: "ACC",
  digital: "DIG",
  general: "GEN",
};

function generateProductSku(productType?: string) {
  const prefix = SKU_PREFIX[productType ?? "general"] ?? "PRD";
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${suffix}`;
}

const emptyForm = {
  name: "",
  product_type: "general",
  price: "",
  cost: "",
  stock_qty: "",
  reorder_level: "5",
  image_url: "",
  description: "",
  is_digital: false,
  status: "active",
};

export default function ShopProductsPage() {
  const { user } = useAuth();
  const { currentSchool } = useSchoolInfo();
  const schoolId = currentSchool?.id ?? null;
  const currency = currentSchool?.currency ?? "GHS";
  const access = useModuleAccess("school_shop");

  const [rows, setRows] = useState<ProductRow[]>([]);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [viewing, setViewing] = useState<ProductRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const money = (n: number) => formatMoney(Number(n) || 0, currency);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("shop_products")
        .select("*")
        .eq("school_id", schoolId)
        .order("name");
      if (error) {
        if (isMissingTableError(error)) {
          setSchemaMissing(true);
          setRows([]);
          return;
        }
        throw error;
      }
      setSchemaMissing(false);
      setRows((data ?? []) as ProductRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!showArchived && r.is_archived) return false;
      if (showArchived && !r.is_archived) return false;
      if (typeFilter !== "all" && r.product_type !== typeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.sku ?? "").toLowerCase().includes(q) ||
        (r.product_type ?? "").toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, showArchived, typeFilter, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (row: ProductRow) => {
    setEditing(row);
    setForm({
      name: row.name,
      product_type: row.product_type || "general",
      price: String(row.price ?? ""),
      cost: String(row.cost ?? ""),
      stock_qty: String(row.stock_qty ?? ""),
      reorder_level: String(row.reorder_level ?? 5),
      image_url: row.image_url ?? "",
      description: row.description ?? "",
      is_digital: Boolean(row.is_digital),
      status: row.status || "active",
    });
    setFormOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    if (!schoolId) return;
    setUploading(true);
    try {
      const url = await uploadShopProductImage({
        schoolId,
        file,
        productId: editing?.id,
      });
      setForm((f) => ({ ...f, image_url: url }));
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!schoolId) return;
    if (!form.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        school_id: schoolId,
        name: form.name.trim(),
        product_type: form.product_type,
        price: form.price === "" ? 0 : Number(form.price),
        cost: form.cost === "" ? 0 : Number(form.cost),
        stock_qty: form.stock_qty === "" ? 0 : Number(form.stock_qty),
        reorder_level: form.reorder_level === "" ? 5 : Number(form.reorder_level),
        image_url: form.image_url.trim() || null,
        description: form.description.trim() || null,
        is_digital: form.is_digital,
        status: form.status,
        updated_at: new Date().toISOString(),
      };
      if (user?.id) payload.updated_by = user.id;

      if (editing?.id) {
        if (editing.sku) payload.sku = editing.sku;
        else payload.sku = generateProductSku(form.product_type);
        let { error } = await supabase.from("shop_products").update(payload).eq("id", editing.id);
        if (error && /foreign key|updated_by|created_by/i.test(`${error.message} ${error.details ?? ""}`)) {
          delete payload.updated_by;
          ({ error } = await supabase.from("shop_products").update(payload).eq("id", editing.id));
        }
        if (error) throw error;
        toast.success("Product updated");
      } else {
        payload.sku = generateProductSku(form.product_type);
        if (user?.id) payload.created_by = user.id;
        let { error } = await supabase.from("shop_products").insert(payload);
        if (error && /foreign key|updated_by|created_by/i.test(`${error.message} ${error.details ?? ""}`)) {
          delete payload.updated_by;
          delete payload.created_by;
          ({ error } = await supabase.from("shop_products").insert(payload));
        }
        if (error) throw error;
        toast.success("Product created");
      }
      setFormOpen(false);
      setViewing(null);
      void load();
    } catch (e) {
      const err = e as { message?: string; details?: string; hint?: string };
      toast.error([err.message, err.details, err.hint].filter(Boolean).join(" — ") || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (row: ProductRow, archived: boolean) => {
    try {
      const { error } = await supabase
        .from("shop_products")
        .update({
          is_archived: archived,
          status: archived ? "archived" : "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) throw error;
      toast.success(archived ? "Archived" : "Restored");
      if (viewing?.id === row.id) setViewing(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archive failed");
    }
  };

  const handleDelete = async (row: ProductRow) => {
    if (!confirm(`Permanently delete “${row.name}”?`)) return;
    try {
      const { error } = await supabase.from("shop_products").delete().eq("id", row.id);
      if (error) throw error;
      toast.success("Deleted");
      if (viewing?.id === row.id) setViewing(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (!access.canView) return <ModuleAccessDenied label="School shop" />;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Resources</p>
          <h2 className="font-display text-xl font-semibold tracking-tight">Products</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Catalog for student, parent, and teacher shop portals. Click any item to view details.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {access.canCreate ? (
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add product
            </Button>
          ) : null}
        </div>
      </div>

      {schemaMissing ? (
        <OperationsSchemaSetupCard moduleLabel="Shop products" quickScript="apply-wave-b-f-modules.sql" />
      ) : (
        <>
          <Card className="shadow-none">
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search name, SKU, type…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="md:w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="md:w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant={showArchived ? "secondary" : "outline"}
                onClick={() => setShowArchived((v) => !v)}
              >
                {showArchived ? "Showing archived" : "Show archived"}
              </Button>
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading products…
            </div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed shadow-none">
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                No products match your filters.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((product) => {
                const out = !product.is_digital && Number(product.stock_qty) <= 0;
                return (
                  <Card
                    key={product.id}
                    className="group cursor-pointer overflow-hidden border-border/70 shadow-none transition hover:border-primary/40 hover:shadow-sm"
                    onClick={() => setViewing(product)}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <Package className="h-10 w-10 opacity-40" />
                        </div>
                      )}
                      <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                        {product.status === "active" ? (
                          <Badge variant="success" className="bg-background/95">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-background/95 capitalize">
                            {product.status}
                          </Badge>
                        )}
                        {out ? (
                          <Badge variant="secondary" className="bg-background/95">
                            Out of stock
                          </Badge>
                        ) : null}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-xs font-medium shadow-sm">
                          <Eye className="h-3.5 w-3.5" />
                          View details
                        </span>
                      </div>
                    </div>
                    <CardContent className="space-y-2 p-4">
                      <div>
                        <p className="truncate font-semibold leading-tight">{product.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {TYPE_LABELS[product.product_type] || product.product_type}
                          {product.sku ? ` · ${product.sku}` : ""}
                        </p>
                      </div>
                      <div className="flex items-end justify-between gap-2">
                        <p className="text-lg font-semibold tracking-tight">{money(product.price)}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.is_digital ? "Digital" : `${product.stock_qty} in stock`}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Detail view */}
      <Sheet open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          {viewing ? (
            <>
              <SheetHeader>
                <SheetTitle>{viewing.name}</SheetTitle>
                <SheetDescription>
                  {TYPE_LABELS[viewing.product_type] || viewing.product_type}
                  {viewing.sku ? ` · SKU ${viewing.sku}` : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 py-4">
                <div className="aspect-video overflow-hidden rounded-xl border bg-muted">
                  {viewing.image_url ? (
                    <img
                      src={viewing.image_url}
                      alt={viewing.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Package className="h-10 w-10 opacity-40" />
                      <span className="text-xs">No image</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-2xl font-semibold tracking-tight">{money(viewing.price)}</p>
                  {viewing.status === "active" ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="secondary" className="capitalize">
                      {viewing.status}
                    </Badge>
                  )}
                  {viewing.is_digital ? <Badge variant="outline">Digital</Badge> : null}
                </div>

                <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Stock</dt>
                    <dd className="font-medium">
                      {viewing.is_digital ? "Digital item" : `${viewing.stock_qty} available`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Reorder level</dt>
                    <dd className="font-medium">{viewing.reorder_level ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Cost</dt>
                    <dd className="font-medium">{money(viewing.cost)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Type</dt>
                    <dd className="font-medium">
                      {TYPE_LABELS[viewing.product_type] || viewing.product_type}
                    </dd>
                  </div>
                </dl>

                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Description
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {viewing.description || "No description provided."}
                  </p>
                </div>
              </div>

              <SheetFooter className="mt-auto gap-2 border-t pt-4 sm:flex-col">
                {access.canEdit ? (
                  <Button
                    className="w-full"
                    onClick={() => {
                      openEdit(viewing);
                      setViewing(null);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit product
                  </Button>
                ) : null}
                {access.canEdit ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => void handleArchive(viewing, !viewing.is_archived)}
                  >
                    {viewing.is_archived ? (
                      <>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Restore
                      </>
                    ) : (
                      <>
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </>
                    )}
                  </Button>
                ) : null}
                {access.canDelete ? (
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={() => void handleDelete(viewing)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                ) : null}
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Create / edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2 rounded-lg border p-3">
              <Label className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4" />
                Product image
              </Label>
              {form.image_url ? (
                <div className="relative aspect-video max-w-xs overflow-hidden rounded-lg border bg-muted">
                  <img src={form.image_url} alt="" className="h-full w-full object-cover" />
                </div>
              ) : null}
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImageUpload(file);
                  e.target.value = "";
                }}
              />
              <Input
                type="url"
                placeholder="Or paste image URL"
                value={form.image_url}
                onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
              />
              {uploading ? <p className="text-xs text-muted-foreground">Uploading…</p> : null}
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label>Product name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={form.product_type}
                onValueChange={(v) => setForm((f) => ({ ...f, product_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Price *</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Cost</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.cost}
                onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Stock</Label>
              <Input
                type="number"
                min={0}
                value={form.stock_qty}
                onChange={(e) => setForm((f) => ({ ...f, stock_qty: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Reorder level</Label>
              <Input
                type="number"
                min={0}
                value={form.reorder_level}
                onChange={(e) => setForm((f) => ({ ...f, reorder_level: e.target.value }))}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.is_digital}
                onChange={(e) => setForm((f) => ({ ...f, is_digital: e.target.checked }))}
              />
              Digital product
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
