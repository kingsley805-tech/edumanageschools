import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Settings } from "lucide-react";
import {
  COMMON_CURRENCY_OPTIONS,
  formatMoney,
  getCurrencySymbol,
  normalizeCurrencyCode,
} from "@/lib/currency";

function BillingSettings() {
  const { schoolId, isAdmin } = useBillingAuth();
  const { currentSchool, refetch } = useSchoolInfo();
  const [form, setForm] = useState({
    currency: "GHS",
    billing_invoice_prefix: "INV",
    billing_receipt_footer: "",
  });
  const [customCurrency, setCustomCurrency] = useState(false);

  useEffect(() => {
    if (!currentSchool) return;
    const s = currentSchool as {
      currency?: string;
      billing_invoice_prefix?: string;
      billing_receipt_footer?: string;
    };
    const cur = normalizeCurrencyCode(s.currency);
    const isPreset = COMMON_CURRENCY_OPTIONS.some((o) => o.code === cur);
    setCustomCurrency(!isPreset);
    setForm({
      currency: cur,
      billing_invoice_prefix: s.billing_invoice_prefix?.trim() || "INV",
      billing_receipt_footer: s.billing_receipt_footer?.trim() || "",
    });
  }, [currentSchool]);

  const symbol = useMemo(() => getCurrencySymbol(form.currency), [form.currency]);
  const preview = useMemo(
    () => formatMoney(1250, form.currency, { maximumFractionDigits: 2 }),
    [form.currency],
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("No school linked");
      const { error } = await supabase
        .from("schools")
        .update({
          currency: normalizeCurrencyCode(form.currency),
          billing_invoice_prefix: form.billing_invoice_prefix.trim() || "INV",
          billing_receipt_footer: form.billing_receipt_footer.trim() || null,
        } as never)
        .eq("id", schoolId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      toast.success(`Billing settings saved — amounts will display as ${symbol}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <p className="text-muted-foreground p-6">Only school administrators can change billing settings.</p>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Billing settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Currency symbol and code — applied across invoices, receipts, payroll, and dashboards.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Financial display</CardTitle>
          <CardDescription>Used on invoices, receipts, and reports.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Currency</Label>
            {!customCurrency ? (
              <Select
                value={form.currency}
                onValueChange={(v) => {
                  if (v === "__custom__") {
                    setCustomCurrency(true);
                    return;
                  }
                  setForm({ ...form, currency: v });
                }}
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
                  <SelectItem value="__custom__">Other currency code…</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                  placeholder="USD"
                  maxLength={6}
                  className="uppercase"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const match = COMMON_CURRENCY_OPTIONS.find((o) => o.code === form.currency);
                    if (match) setCustomCurrency(false);
                  }}
                >
                  Presets
                </Button>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Symbol: <span className="font-semibold text-foreground">{symbol}</span>
              <span className="mx-2 text-border">·</span>
              Preview: <span className="font-semibold text-foreground">{preview}</span>
            </p>
          </div>
          <div className="space-y-2">
            <Label>Invoice number prefix</Label>
            <Input
              value={form.billing_invoice_prefix}
              onChange={(e) => setForm({ ...form, billing_invoice_prefix: e.target.value })}
              placeholder="INV"
            />
          </div>
          <div className="space-y-2">
            <Label>Receipt footer (optional)</Label>
            <Textarea
              rows={3}
              value={form.billing_receipt_footer}
              onChange={(e) => setForm({ ...form, billing_receipt_footer: e.target.value })}
              placeholder="Thank you for your payment."
            />
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save settings"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Online payments</CardTitle>
          <CardDescription>Configure Paystack and webhook for parent/student checkout.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/admin/billing/settings/payments">Payment gateway settings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default BillingSettings;
