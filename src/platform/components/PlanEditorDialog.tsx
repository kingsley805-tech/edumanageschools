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
import { buildPackagePermissionSummary } from "@/platform/lib/packagePermissionSummary";
import {
  portalKeysFromPlatformModuleKeys,
  platformModuleKeysFromPortalKeys,
  type PlatformModuleRef,
} from "@/platform/lib/packagePortalPages";
import {
  allPackageSidebarPortalKeys,
  buildPackageSidebarMenu,
} from "@/platform/lib/packageSidebarMenu";
import type { SubscriptionPlan } from "@/platform/lib/types";
import { cn } from "@/lib/utils";

export type PlanFormValues = {
  slug: string;
  name: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  sms_addon_fee_monthly: number;
  sms_addon_fee_annual: number;
  max_students: string;
  max_teachers: string;
  max_storage_gb: string;
  is_custom: boolean;
  is_active: boolean;
  sort_order: number;
  default_modules: string[];
};

type PlatformModule = PlatformModuleRef;

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
    sms_addon_fee_monthly: 0,
    sms_addon_fee_annual: 0,
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
    sms_addon_fee_monthly: Number(plan.sms_addon_fee_monthly ?? 0),
    sms_addon_fee_annual: Number(plan.sms_addon_fee_annual ?? 0),
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

  const sidebarMenu = useMemo(() => buildPackageSidebarMenu(), []);

  const selectedPortalKeys = useMemo(
    () => portalKeysFromPlatformModuleKeys(form.default_modules, modules),
    [form.default_modules, modules],
  );

  const permissionSummary = useMemo(
    () => buildPackagePermissionSummary(form.default_modules, modules),
    [form.default_modules, modules],
  );

  const selectedCount = selectedPortalKeys.length;

  const togglePortalPage = (portalKey: string) => {
    setForm((f) => {
      const keys = new Set(portalKeysFromPlatformModuleKeys(f.default_modules, modules));
      if (keys.has(portalKey)) keys.delete(portalKey);
      else keys.add(portalKey);
      return {
        ...f,
        default_modules: platformModuleKeysFromPortalKeys([...keys], modules),
      };
    });
  };

  const selectAllSidebarItems = () => {
    setForm((f) => ({
      ...f,
      default_modules: platformModuleKeysFromPortalKeys(allPackageSidebarPortalKeys(), modules),
    }));
  };

  const toggleSidebarGroup = (portalKeys: string[], select: boolean) => {
    setForm((f) => {
      const keys = new Set(portalKeysFromPlatformModuleKeys(f.default_modules, modules));
      for (const key of portalKeys) {
        if (select) keys.add(key);
        else keys.delete(key);
      }
      return {
        ...f,
        default_modules: platformModuleKeysFromPortalKeys([...keys], modules),
      };
    });
  };

  const renderSidebarItem = (item: {
    portalKey: string;
    label: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
  }) => {
    const Icon = item.icon;
    const checked = selectedPortalKeys.includes(item.portalKey);
    return (
      <label
        key={`${item.path}-${item.portalKey}`}
        className={cn(
          "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/60",
          checked && "bg-muted/40",
        )}
      >
        <Checkbox
          className="shrink-0"
          checked={checked}
          onCheckedChange={() => togglePortalPage(item.portalKey)}
        />
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium leading-tight">{item.label}</span>
          <span className="block truncate text-xs text-muted-foreground">{item.path}</span>
        </span>
      </label>
    );
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
            Define pricing, limits, and which sidebar menu items schools can access on this plan.
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
                <Label>SMS add-on — monthly (GHS)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.sms_addon_fee_monthly}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sms_addon_fee_monthly: Number(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>SMS add-on — annual (GHS)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.sms_addon_fee_annual}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sms_addon_fee_annual: Number(e.target.value) || 0 }))
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Optional parent SMS notification fee added at checkout when schools enable SMS during purchase or renewal.
              </p>
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
                <Label>Sidebar menu items</Label>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={selectAllSidebarItems}>
                    Select all
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
                Choose the same pages that appear in the school admin sidebar. Subscription and account settings are always included and cannot be removed.
              </p>
              <div className="rounded-lg border bg-sidebar/30 p-2 space-y-3 max-h-80 overflow-y-auto">
                {sidebarMenu.standalone.map((item) => renderSidebarItem(item))}

                {sidebarMenu.groups.map((group) => {
                  const groupKeys = group.items.map((i) => i.portalKey);
                  const allSelected = groupKeys.every((k) => selectedPortalKeys.includes(k));
                  const someSelected = groupKeys.some((k) => selectedPortalKeys.includes(k));
                  const GroupIcon = group.icon;

                  return (
                    <div key={group.label} className="rounded-md border border-border/60 bg-background/80">
                      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-2 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <GroupIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {group.label}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => toggleSidebarGroup(groupKeys, !allSelected)}
                        >
                          {allSelected ? "Clear group" : someSelected ? "Select all in group" : "Select group"}
                        </Button>
                      </div>
                      <div className="py-1">{group.items.map((item) => renderSidebarItem(item))}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <Label className="text-base">Sidebar summary</Label>
                <Badge variant="secondary">
                  {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
                </Badge>
              </div>
              {selectedCount === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No sidebar items selected. Schools on this plan will only see subscription management until you add menu items.
                </p>
              ) : (
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {permissionSummary.map((group) => (
                    <div key={group.categoryLabel}>
                      <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                        {group.categoryLabel}
                      </p>
                      <ul className="space-y-1">
                        {group.items.map((item) => (
                          <li key={item.path ?? item.label} className="text-sm">
                            <span className="font-medium">{item.label}</span>
                            {item.path ? (
                              <span className="ml-2 text-xs text-muted-foreground">{item.path}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Saving applies these sidebar permissions automatically when a school purchases, is assigned, or changes to this package.
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
    sms_addon_fee_monthly: values.sms_addon_fee_monthly,
    sms_addon_fee_annual: values.sms_addon_fee_annual,
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
