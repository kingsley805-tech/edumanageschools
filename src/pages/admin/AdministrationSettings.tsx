import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolInfo, SCHOOL_INFO_QUERY_KEY } from "@/hooks/useSchoolInfo";
import { usePermissions } from "@/hooks/usePermissions";
import { permissionCode } from "@/lib/rbac/permissionCatalog";
import {
  DEFAULT_TEMPLATES,
  DEFAULT_WHATSAPP_SETTINGS,
  loadWhatsAppSchoolSettings,
  resendWhatsAppDelivery,
  saveWhatsAppSchoolSettings,
  type WhatsAppSchoolSettings,
} from "@/lib/whatsapp";
import {
  DEFAULT_SMS_REPORT_CARD_TEMPLATE,
  loadReportCardSmsSettings,
  saveReportCardSmsSettings,
  type ReportCardSmsSettings,
} from "@/report/lib/report-card-sms";
import { ALL_PAYMENT_METHODS } from "@/billing/lib/posSettings";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import {
  COMMON_CURRENCY_OPTIONS,
  getCurrencySymbol,
  normalizeCurrencyCode,
} from "@/lib/currency";
import {
  Building2,
  CreditCard,
  FileText,
  LineChart,
  Loader2,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  Save,
  Send,
  Settings,
  Store,
} from "lucide-react";

type DeliveryRow = {
  id: string;
  message_type: string;
  recipient_phone: string | null;
  recipient_name: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
};

type SummaryRow = {
  id: string;
  summary_date: string;
  delivery_status: string;
  delivered_at: string | null;
};

type SchoolProfileForm = {
  school_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  currency: string;
  billing_invoice_prefix: string;
  billing_receipt_footer: string;
};

const TAB_ALIASES: Record<string, string> = {
  payments: "pos",
  notifications: "whatsapp",
  backup: "general",
};

const TABS = [
  { key: "general", label: "General", icon: Settings },
  { key: "receipt", label: "Receipt", icon: FileText },
  { key: "finance", label: "Finance", icon: CreditCard },
  { key: "pos", label: "POS", icon: Store },
  { key: "whatsapp", label: "WhatsApp & SMS", icon: MessageCircle },
  { key: "daily-summary", label: "Daily Summary", icon: LineChart },
] as const;

function statusBadge(status: string) {
  const map: Record<string, string> = {
    sent: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    delivered: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    failed: "bg-rose-500/10 text-rose-700 border-rose-500/30",
    skipped: "bg-amber-500/10 text-amber-800 border-amber-500/30",
    pending: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    queued: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    sending: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  };
  return (
    <Badge variant="outline" className={`capitalize text-xs ${map[status] ?? ""}`}>
      {status}
    </Badge>
  );
}

function parseAddressParts(address: string | null | undefined): { city: string; country: string; line: string } {
  const raw = (address ?? "").trim();
  if (!raw) return { city: "", country: "", line: "" };
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return { line: parts.slice(0, -2).join(", "), city: parts[parts.length - 2], country: parts[parts.length - 1] };
  }
  if (parts.length === 2) {
    return { line: parts[0], city: parts[1], country: "" };
  }
  return { line: raw, city: "", country: "" };
}

function composeAddress(line: string, city: string, country: string): string | null {
  const parts = [line.trim(), city.trim(), country.trim()].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export default function AdministrationSettings() {
  const { user } = useAuth();
  const { currentSchool, refetch: refetchSchool } = useSchoolInfo();
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab") || "general";
  const tab = TAB_ALIASES[rawTab] || rawTab;

  const canManage =
    isSuperAdmin ||
    hasPermission(permissionCode("administration_settings", "manage")) ||
    hasPermission(permissionCode("administration_settings", "edit")) ||
    hasPermission(permissionCode("school_settings", "manage")) ||
    hasPermission(permissionCode("whatsapp", "manage"));

  const schoolId = currentSchool?.id ?? null;
  const [settings, setSettings] = useState<WhatsAppSchoolSettings>({ ...DEFAULT_WHATSAPP_SETTINGS });
  const [smsReportSettings, setSmsReportSettings] = useState<ReportCardSmsSettings>({
    sms_auto_send_report_card: false,
    sms_teacher_can_send_report_card: false,
    sms_report_card_template: DEFAULT_SMS_REPORT_CARD_TEMPLATE,
    sms_sender_id: "",
    whatsapp_default_country_code: "233",
  });
  const [profile, setProfile] = useState<SchoolProfileForm>({
    school_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    currency: "GHS",
    billing_invoice_prefix: "INV",
    billing_receipt_footer: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const [summaryEnabled, setSummaryEnabled] = useState(true);
  const [summaryTimezone, setSummaryTimezone] = useState("Africa/Accra");
  const [summaryTime, setSummaryTime] = useState("10:00");
  const [summaries, setSummaries] = useState<SummaryRow[]>([]);
  const [sendingSummary, setSendingSummary] = useState(false);

  const setTab = (next: string) => {
    setSearchParams({ tab: next });
  };

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [wa, smsReport, schoolRes, summarySettings, summaryRows] = await Promise.all([
        loadWhatsAppSchoolSettings(schoolId),
        loadReportCardSmsSettings(schoolId),
        supabase
          .from("schools")
          .select(
            "school_name, email, phone, address, currency, billing_invoice_prefix, billing_receipt_footer",
          )
          .eq("id", schoolId)
          .maybeSingle(),
        supabase
          .from("school_settings")
          .select("timezone, daily_summary_enabled, daily_summary_time")
          .eq("school_id", schoolId)
          .maybeSingle(),
        supabase
          .from("daily_school_summaries")
          .select("id, summary_date, delivery_status, delivered_at")
          .eq("school_id", schoolId)
          .order("summary_date", { ascending: false })
          .limit(14),
      ]);

      setSettings(wa);
      setSmsReportSettings(smsReport);

      if (schoolRes.error) throw schoolRes.error;
      const school = schoolRes.data;
      if (school) {
        const parts = parseAddressParts(school.address);
        setProfile({
          school_name: school.school_name || "",
          email: school.email || "",
          phone: school.phone || "",
          address: parts.line,
          city: parts.city,
          country: parts.country || "Ghana",
          currency: normalizeCurrencyCode(school.currency),
          billing_invoice_prefix: school.billing_invoice_prefix?.trim() || "INV",
          billing_receipt_footer: school.billing_receipt_footer?.trim() || "",
        });
      }

      if (summarySettings.data) {
        const s = summarySettings.data as {
          timezone?: string | null;
          daily_summary_enabled?: boolean | null;
          daily_summary_time?: string | null;
        };
        setSummaryTimezone(s.timezone || "Africa/Accra");
        setSummaryEnabled(s.daily_summary_enabled ?? true);
        setSummaryTime(String(s.daily_summary_time || "10:00").slice(0, 5));
      }
      setSummaries((summaryRows.data as SummaryRow[]) || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  const loadDeliveries = useCallback(async () => {
    if (!schoolId) return;
    setLoadingDeliveries(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_deliveries")
        .select("id, message_type, recipient_phone, recipient_name, status, error_message, created_at, sent_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) {
          setDeliveries([]);
          return;
        }
        throw error;
      }
      setDeliveries((data as DeliveryRow[]) || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load delivery log");
    } finally {
      setLoadingDeliveries(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === "whatsapp") void loadDeliveries();
  }, [tab, loadDeliveries]);

  const handleSaveProfile = async () => {
    if (!schoolId || !canManage) return;
    if (!profile.school_name.trim()) {
      toast.error("School name is required");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("schools")
        .update({
          school_name: profile.school_name.trim(),
          email: profile.email.trim() || null,
          phone: profile.phone.trim() || null,
          address: composeAddress(profile.address, profile.city, profile.country),
          currency: normalizeCurrencyCode(profile.currency),
          billing_invoice_prefix: profile.billing_invoice_prefix.trim() || "INV",
          billing_receipt_footer: profile.billing_receipt_footer.trim() || null,
        })
        .eq("id", schoolId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: [SCHOOL_INFO_QUERY_KEY] });
      await refetchSchool();
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWhatsApp = async () => {
    if (!schoolId || !canManage) return;
    setSaving(true);
    try {
      await saveWhatsAppSchoolSettings(schoolId, settings);
      await saveReportCardSmsSettings(schoolId, {
        sms_auto_send_report_card: smsReportSettings.sms_auto_send_report_card,
        sms_teacher_can_send_report_card: smsReportSettings.sms_teacher_can_send_report_card,
        sms_report_card_template: smsReportSettings.sms_report_card_template,
      });
      toast.success("WhatsApp, SMS & POS settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDailySummary = async () => {
    if (!schoolId || !canManage) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("school_settings")
        .select("id")
        .eq("school_id", schoolId)
        .maybeSingle();

      const patch = {
        timezone: summaryTimezone,
        daily_summary_enabled: summaryEnabled,
        daily_summary_time: summaryTime.length === 5 ? `${summaryTime}:00` : summaryTime,
        school_id: schoolId,
      };

      if (existing?.id) {
        const { error } = await supabase.from("school_settings").update(patch).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("school_settings").insert(patch);
        if (error) throw error;
      }
      toast.success("Daily summary settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const activeTab = useMemo(
    () => (TABS.some((t) => t.key === tab) ? tab : "general"),
    [tab],
  );

  const handleSave = async () => {
    if (activeTab === "whatsapp" || activeTab === "pos") {
      await handleSaveWhatsApp();
      return;
    }
    if (activeTab === "daily-summary") {
      await handleSaveDailySummary();
      return;
    }
    await handleSaveProfile();
  };

  const handleResend = async (id: string) => {
    setResendingId(id);
    try {
      await resendWhatsAppDelivery(id);
      toast.success("WhatsApp message requeued");
      await loadDeliveries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Resend failed");
    } finally {
      setResendingId(null);
    }
  };

  const sendTestSummary = async () => {
    if (!schoolId) return;
    setSendingSummary(true);
    try {
      await invokeEdgeFunction("daily-school-summary", {
        manual: true,
        force: true,
        school_id: schoolId,
      });
      toast.success("Test summary generated and delivered");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send test summary");
    } finally {
      setSendingSummary(false);
    }
  };

  const currencySymbol = getCurrencySymbol(profile.currency);

  if (!schoolId) {
    return (
      <DashboardLayout role="admin">
        <p className="text-muted-foreground py-8 text-center">No school linked to your account.</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
            <Badge
              variant="secondary"
              className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
            >
              Preferences
            </Badge>
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Settings className="h-4 w-4 shrink-0" />
            Configure school profile, receipts, POS payments, messaging, and daily summaries.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/school-settings">
              <Building2 className="mr-2 h-4 w-4" />
              Logo & branding
            </Link>
          </Button>
          {canManage ? (
            <Button onClick={() => void handleSave()} disabled={saving || loading}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setTab} className="w-full">
            <div className="overflow-x-auto px-5 pt-4 sm:px-6">
              <TabsList className="min-w-max gap-5 sm:gap-6">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <div className="px-5 py-6 sm:px-6">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <TabsContent value="general" className="mt-0 space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="school-name">
                        School Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="school-name"
                        value={profile.school_name}
                        onChange={(e) => setProfile((p) => ({ ...p, school_name: e.target.value }))}
                        disabled={!canManage}
                      />
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="school-email">School Email</Label>
                        <Input
                          id="school-email"
                          type="email"
                          value={profile.email}
                          onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                          disabled={!canManage}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="school-phone">School Phone</Label>
                        <Input
                          id="school-phone"
                          value={profile.phone}
                          onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                          disabled={!canManage}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="school-address">School Address</Label>
                      <Textarea
                        id="school-address"
                        rows={3}
                        value={profile.address}
                        onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                        disabled={!canManage}
                      />
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="school-city">City</Label>
                        <Input
                          id="school-city"
                          value={profile.city}
                          onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
                          disabled={!canManage}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="school-country">Country</Label>
                        <Input
                          id="school-country"
                          value={profile.country}
                          onChange={(e) => setProfile((p) => ({ ...p, country: e.target.value }))}
                          disabled={!canManage}
                        />
                      </div>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Currency</Label>
                        <Select
                          value={profile.currency}
                          onValueChange={(v) => setProfile((p) => ({ ...p, currency: v }))}
                          disabled={!canManage}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COMMON_CURRENCY_OPTIONS.map((o) => (
                              <SelectItem key={o.code} value={o.code}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="currency-symbol">Currency Symbol</Label>
                        <Input id="currency-symbol" value={currencySymbol} disabled className="bg-muted" />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="receipt" className="mt-0 space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="invoice-prefix">Invoice number prefix</Label>
                      <Input
                        id="invoice-prefix"
                        value={profile.billing_invoice_prefix}
                        onChange={(e) =>
                          setProfile((p) => ({ ...p, billing_invoice_prefix: e.target.value }))
                        }
                        disabled={!canManage}
                        placeholder="INV"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="receipt-footer">Receipt footer</Label>
                      <Textarea
                        id="receipt-footer"
                        rows={4}
                        value={profile.billing_receipt_footer}
                        onChange={(e) =>
                          setProfile((p) => ({ ...p, billing_receipt_footer: e.target.value }))
                        }
                        disabled={!canManage}
                        placeholder="Thank you for your payment."
                      />
                      <p className="text-xs text-muted-foreground">
                        Shown at the bottom of fee payment receipts.
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="finance" className="mt-0 space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Display currency</Label>
                        <Select
                          value={profile.currency}
                          onValueChange={(v) => setProfile((p) => ({ ...p, currency: v }))}
                          disabled={!canManage}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COMMON_CURRENCY_OPTIONS.map((o) => (
                              <SelectItem key={o.code} value={o.code}>
                                {getCurrencySymbol(o.code)} — {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Symbol</Label>
                        <Input value={currencySymbol} disabled className="bg-muted" />
                      </div>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="font-medium text-sm">Online payment gateways</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Connect Paystack for parent and student fee checkout.
                      </p>
                      <Button variant="outline" className="mt-3" asChild>
                        <Link to="/admin/billing/settings/payments">Payment gateway settings</Link>
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="pos" className="mt-0 space-y-5">
                    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                      <div>
                        <p className="font-medium">Enable POS Terminal method</p>
                        <p className="text-sm text-muted-foreground">
                          Shows &quot;POS Terminal&quot; alongside Cash, Mobile Money, and Bank Transfer.
                        </p>
                      </div>
                      <Switch
                        checked={settings.pos_terminal_enabled}
                        onCheckedChange={(v) => setSettings((s) => ({ ...s, pos_terminal_enabled: v }))}
                        disabled={!canManage}
                      />
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Display label</Label>
                        <Input
                          value={settings.pos_terminal_label}
                          onChange={(e) =>
                            setSettings((s) => ({ ...s, pos_terminal_label: e.target.value }))
                          }
                          disabled={!canManage}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                        <div>
                          <p className="text-sm font-medium">Require transaction reference</p>
                          <p className="text-xs text-muted-foreground">
                            Approval / RRN / terminal receipt number
                          </p>
                        </div>
                        <Switch
                          checked={settings.pos_require_reference}
                          onCheckedChange={(v) =>
                            setSettings((s) => ({ ...s, pos_require_reference: v }))
                          }
                          disabled={!canManage}
                        />
                      </div>
                    </div>
                    <div className="rounded-lg border p-4 space-y-3">
                      <p className="font-medium text-sm">Available payment methods</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {ALL_PAYMENT_METHODS.map((m) => {
                          const enabled = (settings.pos_enabled_payment_methods ?? []).includes(m.value);
                          return (
                            <label key={m.value} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={enabled}
                                disabled={!canManage}
                                onChange={(e) => {
                                  setSettings((s) => {
                                    const current = s.pos_enabled_payment_methods ?? [];
                                    const next = e.target.checked
                                      ? [...new Set([...current, m.value])]
                                      : current.filter((v) => v !== m.value);
                                    return { ...s, pos_enabled_payment_methods: next };
                                  });
                                }}
                              />
                              {m.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                        <div>
                          <p className="text-sm font-medium">Auto-print receipt after payment</p>
                          <p className="text-xs text-muted-foreground">Opens print dialog when a POS payment succeeds.</p>
                        </div>
                        <Switch
                          checked={Boolean(settings.pos_auto_print_receipt)}
                          onCheckedChange={(v) => setSettings((s) => ({ ...s, pos_auto_print_receipt: v }))}
                          disabled={!canManage}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Receipt paper width (mm)</Label>
                        <Select
                          value={String(settings.pos_receipt_paper_width_mm ?? 80)}
                          onValueChange={(v) =>
                            setSettings((s) => ({ ...s, pos_receipt_paper_width_mm: Number(v) }))
                          }
                          disabled={!canManage}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="58">58 mm (thermal)</SelectItem>
                            <SelectItem value="80">80 mm (thermal)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button variant="outline" asChild>
                      <Link to="/admin/billing/pos-terminal">Open School POS Terminal</Link>
                    </Button>
                  </TabsContent>

                  <TabsContent value="whatsapp" className="mt-0 space-y-6">
                    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                      <div>
                        <p className="font-medium">Enable WhatsApp</p>
                        <p className="text-sm text-muted-foreground">
                          When off, messages are not queued and operations continue normally.
                        </p>
                      </div>
                      <Switch
                        checked={settings.whatsapp_enabled}
                        onCheckedChange={(v) => setSettings((s) => ({ ...s, whatsapp_enabled: v }))}
                        disabled={!canManage}
                      />
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Default country code</Label>
                        <Input
                          value={settings.whatsapp_default_country_code}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              whatsapp_default_country_code: e.target.value.replace(/\D/g, "").slice(0, 4),
                            }))
                          }
                          disabled={!canManage}
                          placeholder="233"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Provider</Label>
                        <Input value={settings.whatsapp_provider} disabled className="bg-muted" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-medium">Auto-send</p>
                      {(
                        [
                          ["whatsapp_auto_send_fee_receipt", "Fee payment receipts"],
                          ["whatsapp_auto_send_fee_notification", "Fee outstanding notifications"],
                          ["whatsapp_auto_send_report_card", "Report cards"],
                          ["whatsapp_auto_send_weekly_attention", "Weekly student attention"],
                        ] as const
                      ).map(([key, label]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-4 rounded-md border px-3 py-2"
                        >
                          <span className="text-sm">{label}</span>
                          <Switch
                            checked={Boolean(settings[key])}
                            onCheckedChange={(v) => setSettings((s) => ({ ...s, [key]: v }))}
                            disabled={!canManage}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                      <div>
                        <p className="font-medium text-sm">Attach receipt PDF to WhatsApp</p>
                        <p className="text-xs text-muted-foreground">
                          Sends the generated PDF with fee payment receipt messages.
                        </p>
                      </div>
                      <Switch
                        checked={settings.whatsapp_send_receipt_pdf !== false}
                        onCheckedChange={(v) => setSettings((s) => ({ ...s, whatsapp_send_receipt_pdf: v }))}
                        disabled={!canManage}
                      />
                    </div>

                    <div className="space-y-4">
                      <p className="text-sm font-medium">Message templates</p>
                      <p className="text-xs text-muted-foreground">
                        Fee receipt and fee notification messages use fixed system templates (not
                        editable here). Customize report card and weekly attention below.
                      </p>
                      {(
                        [
                          ["whatsapp_report_card_template", "Report card", DEFAULT_TEMPLATES.report_card],
                          [
                            "whatsapp_weekly_attention_template",
                            "Weekly attention",
                            DEFAULT_TEMPLATES.weekly_attention,
                          ],
                        ] as const
                      ).map(([key, label, fallback]) => (
                        <div key={key} className="space-y-2">
                          <Label>{label}</Label>
                          <Textarea
                            rows={3}
                            value={settings[key] || fallback}
                            onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
                            disabled={!canManage}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="rounded-lg border p-4 space-y-4">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                        <div>
                          <p className="font-medium text-sm">SMS Report Card</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Send the student&apos;s report card to linked parents by SMS with a PDF
                            download link (Student name, school name, term, and PDF URL).
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">Auto-send report card by SMS</p>
                          <p className="text-xs text-muted-foreground">
                            When parents are notified (Forward to parents), also SMS the PDF link.
                          </p>
                        </div>
                        <Switch
                          checked={smsReportSettings.sms_auto_send_report_card}
                          onCheckedChange={(v) =>
                            setSmsReportSettings((s) => ({ ...s, sms_auto_send_report_card: v }))
                          }
                          disabled={!canManage}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">Allow teachers to send SMS</p>
                          <p className="text-xs text-muted-foreground">
                            Teachers can manually SMS a student&apos;s report card to linked parents.
                          </p>
                        </div>
                        <Switch
                          checked={smsReportSettings.sms_teacher_can_send_report_card}
                          onCheckedChange={(v) =>
                            setSmsReportSettings((s) => ({
                              ...s,
                              sms_teacher_can_send_report_card: v,
                            }))
                          }
                          disabled={!canManage}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>SMS template</Label>
                        <Textarea
                          rows={3}
                          value={smsReportSettings.sms_report_card_template}
                          onChange={(e) =>
                            setSmsReportSettings((s) => ({
                              ...s,
                              sms_report_card_template: e.target.value,
                            }))
                          }
                          disabled={!canManage}
                        />
                        <p className="text-xs text-muted-foreground">
                          Placeholders: {"{student_name}"}, {"{school_name}"}, {"{term}"},{" "}
                          {"{pdf_link}"}
                        </p>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Manual SMS send is available on each report card review page (admin always;
                        teachers when enabled above). Sender ID uses your Attendance SMS sender
                        setting.
                      </p>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="font-medium text-sm">Attendance SMS</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Parent SMS when attendance is saved (Arkesel).
                      </p>
                      <Button variant="outline" className="mt-3" asChild>
                        <Link to="/admin/register?tab=settings">Attendance SMS settings</Link>
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">Delivery log</p>
                          <p className="text-xs text-muted-foreground">Recent WhatsApp sends</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void loadDeliveries()}
                          disabled={loadingDeliveries}
                        >
                          <RefreshCw
                            className={`mr-1 h-4 w-4 ${loadingDeliveries ? "animate-spin" : ""}`}
                          />
                          Refresh
                        </Button>
                      </div>
                      {deliveries.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">No deliveries yet.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Type</TableHead>
                                <TableHead>Recipient</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>When</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {deliveries.map((d) => (
                                <TableRow key={d.id}>
                                  <TableCell className="text-sm capitalize">
                                    {d.message_type.replace(/_/g, " ")}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    <div>{d.recipient_name || "—"}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {d.recipient_phone || "—"}
                                    </div>
                                    {d.error_message ? (
                                      <div className="mt-0.5 text-xs text-rose-600">{d.error_message}</div>
                                    ) : null}
                                  </TableCell>
                                  <TableCell>{statusBadge(d.status)}</TableCell>
                                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                    {new Date(d.sent_at || d.created_at).toLocaleString("en-GB")}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {(d.status === "failed" || d.status === "skipped") && canManage ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={resendingId === d.id}
                                        onClick={() => void handleResend(d.id)}
                                      >
                                        {resendingId === d.id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          "Resend"
                                        )}
                                      </Button>
                                    ) : null}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="daily-summary" className="mt-0 space-y-5">
                    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                      <div>
                        <p className="font-medium">Enable Daily Summary</p>
                        <p className="text-sm text-muted-foreground">
                          Email/SMS digest of the previous school day for administrators.
                        </p>
                      </div>
                      <Switch
                        checked={summaryEnabled}
                        onCheckedChange={setSummaryEnabled}
                        disabled={!canManage}
                      />
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="summary-tz">Timezone</Label>
                        <Input
                          id="summary-tz"
                          value={summaryTimezone}
                          onChange={(e) => setSummaryTimezone(e.target.value)}
                          disabled={!canManage}
                          placeholder="Africa/Accra"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="summary-time">Send time</Label>
                        <Input
                          id="summary-time"
                          type="time"
                          value={summaryTime}
                          onChange={(e) => setSummaryTime(e.target.value)}
                          disabled={!canManage}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void sendTestSummary()}
                        disabled={sendingSummary || !schoolId}
                      >
                        {sendingSummary ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Send test summary
                      </Button>
                      <Button variant="outline" asChild>
                        <Link to="/admin/daily-summary">Open full history</Link>
                      </Button>
                    </div>
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Delivered</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summaries.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell className="font-mono text-sm">{s.summary_date}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{s.delivery_status}</Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {s.delivered_at ? new Date(s.delivered_at).toLocaleString() : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                          {!summaries.length ? (
                            <TableRow>
                              <TableCell
                                colSpan={3}
                                className="py-6 text-center text-sm text-muted-foreground"
                              >
                                No summaries yet. Use Send test summary to generate one.
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>

      <span className="hidden">{user?.id}</span>
    </DashboardLayout>
  );
}
