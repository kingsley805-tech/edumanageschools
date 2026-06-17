// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { categoryLabel } from "@/platform/lib/moduleCategories";
import { buildPackagePermissionSummary } from "@/platform/lib/packagePermissionSummary";
import type { SubscriptionPlan } from "@/platform/lib/types";

export type PlanFormValues = {
  slug: string;
  name: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  max_students: string;
  max_teachers: string;
  max_storage_gb: string;
  is_custom: boolean;
  is_active: boolean;
  sort_order: number;
  default_modules: string[];
};

type PlatformModule = {
  module_key: string;
  category: string;
  label: string;
  portal_module_key?: string | null;
};

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

function emptyForm(): PlanFormValues {
  return {
    slug: "",
    name: "",
    description: "",
    price_monthly: 0,
    price_annual: 0,
    max_students: "",
    max_teachers: "",
    max_storage_gb: "",
    is_custom: false,
    is_active: true,
    sort_order: 50,
    default_modules: [],
  };
}

function planToForm(plan: SubscriptionPlan): PlanFormValues {
  return {
    slug: plan.slug,
    name: plan.name,
    description: plan.description ?? "",
    price_monthly: Number(plan.price_monthly),
    price_annual: Number(plan.price_annual),
    max_students: plan.max_students != null ? String(plan.max_students) : "",
    max_teachers: plan.max_teachers != null ? String(plan.max_teachers) : "",
    max_storage_gb: plan.max_storage_gb != null ? String(plan.max_storage_gb) : "",
    is_custom: plan.is_custom,
    is_active: plan.is_active,
    sort_order: plan.sort_order ?? 50,
    default_modules: Array.isArray(plan.default_modules) ? [...plan.default_modules] : [],
  };
}

function parseLimit(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: SubscriptionPlan | null;
  modules: PlatformModule[];
  saving: boolean;
  onSave: (values: PlanFormValues, planId?: string) => Promise<void>;
};

export default function PlanEditorDialog({
  open,
  onOpenChange,
  plan,
  modules,
  saving,
  onSave,
}: Props) {
  const isEdit = Boolean(plan);
  const [form, setForm] = useState<PlanFormValues>(emptyForm);
  const [slugManual, setSlugManual] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (plan) {
      setForm(planToForm(plan));
      setSlugManual(true);
    } else {
      setForm(emptyForm());
      setSlugManual(false);
    }
  }, [open, plan]);

  const byCategory = useMemo(() => {
    const map: Record<string, PlatformModule[]> = {};
    for (const m of modules) {
      (map[m.category] ??= []).push(m);
    }
    return map;
  }, [modules]);

  const permissionSummary = useMemo(
    () => buildPackagePermissionSummary(form.default_modules, modules),
    [form.default_modules, modules],
  );

  const selectedCount = form.default_modules.length;

  const toggleModule = (key: string) => {
    setForm((f) => {
      const set = new Set(f.default_modules);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return { ...f, default_modules: [...set] };
    });
  };

  const handleNameChange = (name: string) => {
    setForm((f) => ({
      ...f,
      name,
      slug: slugManual ? f.slug : slugify(name),
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.slug.trim()) return;
    await onSave(form, plan?.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit subscription plan" : "Create subscription plan"}</DialogTitle>
          <DialogDescription>
            Define pricing, limits, and which modules are included when this plan is applied to a school.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 pb-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Plan name</Label>
                <Input value={form.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Standard Plan" />
              </div>
              <div className="space-y-2">
                <Label>Slug (unique)</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugManual(true);
                    setForm((f) => ({ ...f, slug: slugify(e.target.value) || e.target.value }));
                  }}
                  placeholder="standard"
                />
              </div>
              <div className="space-y-2">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Monthly price (GHS)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.price_monthly}
                  onChange={(e) => setForm((f) => ({ ...f, price_monthly: Number(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Annual price (GHS)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.price_annual}
                  onChange={(e) => setForm((f) => ({ ...f, price_annual: Number(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max students (empty = unlimited)</Label>
                <Input
                  value={form.max_students}
                  onChange={(e) => setForm((f) => ({ ...f, max_students: e.target.value }))}
                  placeholder="500"
                />
              </div>
              <div className="space-y-2">
                <Label>Max teachers (empty = unlimited)</Label>
                <Input
                  value={form.max_teachers}
                  onChange={(e) => setForm((f) => ({ ...f, max_teachers: e.target.value }))}
                  placeholder="20"
                />
              </div>
              <div className="space-y-2">
                <Label>Max storage GB (empty = unlimited)</Label>
                <Input
                  value={form.max_storage_gb}
                  onChange={(e) => setForm((f) => ({ ...f, max_storage_gb: e.target.value }))}
                  placeholder="5"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_custom} onCheckedChange={(v) => setForm((f) => ({ ...f, is_custom: v }))} />
                <Label>Custom / enterprise style</Label>
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <Label>Included pages &amp; modules</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        default_modules: modules.map((m) => m.module_key),
                      }))
                    }
                  >
                    All modules
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, default_modules: [] }))}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <p className="mb-2 text-xs text-muted-foreground">
                Schools assigned this package will only see the selected portal pages. Subscription and account settings are always available.
              </p>
              <div className="rounded-lg border p-3 space-y-4 max-h-64 overflow-y-auto">
                {Object.entries(byCategory).map(([cat, mods]) => (
                  <div key={cat}>
                    <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                      {categoryLabel(cat)}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {mods.map((m) => (
                        <label key={m.module_key} className="flex items-start gap-2 text-sm">
                          <Checkbox
                            className="mt-0.5"
                            checked={form.default_modules.includes(m.module_key)}
                            onCheckedChange={() => toggleModule(m.module_key)}
                          />
                          <span>
                            <span className="block">{m.label}</span>
                            {m.portal_module_key ? (
                              <span className="text-xs text-muted-foreground">
                                Portal: {m.portal_module_key.replace(/_/g, " ")}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Platform feature</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <Label className="text-base">Permission summary</Label>
                <Badge variant="secondary">
                  {selectedCount} module{selectedCount === 1 ? "" : "s"} selected
                </Badge>
              </div>
              {selectedCount === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No modules selected. Schools on this plan will have no portal access except subscription management.
                </p>
              ) : (
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {permissionSummary.map((group) => (
                    <div key={group.category}>
                      <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                        {group.categoryLabel}
                      </p>
                      <ul className="space-y-1">
                        {group.items.map((item) => (
                          <li key={item.moduleKey} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                            <span className="font-medium">{item.label}</span>
                            {item.portalPage && item.portalPage !== item.label ? (
                              <span className="text-xs text-muted-foreground">→ {item.portalPage}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Saving applies these permissions automatically when a school purchases, is assigned, or changes to this package.
              </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving || !form.name.trim() || !form.slug.trim()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEdit ? "Save changes" : "Create plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function planFormToRow(values: PlanFormValues) {
  return {
    slug: values.slug.trim(),
    name: values.name.trim(),
    description: values.description.trim() || null,
    price_monthly: values.price_monthly,
    price_annual: values.price_annual,
    max_students: parseLimit(values.max_students),
    max_teachers: parseLimit(values.max_teachers),
    max_storage_gb: parseLimit(values.max_storage_gb),
    is_custom: values.is_custom,
    is_active: values.is_active,
    sort_order: values.sort_order,
    default_modules: values.default_modules,
    updated_at: new Date().toISOString(),
  };
}
