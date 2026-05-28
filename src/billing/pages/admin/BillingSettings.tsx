import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Settings } from "lucide-react";

function BillingSettings() {
  const { schoolId, isAdmin } = useBillingAuth();
  const { currentSchool, refetch } = useSchoolInfo();
  const [form, setForm] = useState({
    currency: "GHS",
    billing_invoice_prefix: "INV",
    billing_receipt_footer: "",
  });

  useEffect(() => {
    if (!currentSchool) return;
    const s = currentSchool as {
      currency?: string;
      billing_invoice_prefix?: string;
      billing_receipt_footer?: string;
    };
    setForm({
      currency: s.currency?.trim() || "GHS",
      billing_invoice_prefix: s.billing_invoice_prefix?.trim() || "INV",
      billing_receipt_footer: s.billing_receipt_footer?.trim() || "",
    });
  }, [currentSchool]);

  const save = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("No school linked");
      const { error } = await supabase
        .from("schools")
        .update({
          currency: form.currency.trim() || "GHS",
          billing_invoice_prefix: form.billing_invoice_prefix.trim() || "INV",
          billing_receipt_footer: form.billing_receipt_footer.trim() || null,
        } as never)
        .eq("id", schoolId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      toast.success("Billing settings saved");
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
          Currency, invoice numbering, and receipt footer — applied across invoices and PDF receipts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Financial display</CardTitle>
          <CardDescription>Used on invoices, receipts, and reports.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Currency code</Label>
            <Input
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
              placeholder="GHS"
              maxLength={6}
            />
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
