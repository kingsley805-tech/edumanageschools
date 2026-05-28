import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";
import {
  isValidPaystackPublicKey,
  isValidPaystackSecretKey,
  PAYSTACK_PUBLIC_KEY_HINT,
  PAYSTACK_SECRET_KEY_HINT,
} from "@/billing/lib/paystackKeys";
import {
  getPaystackSecretFromSession,
  getPaystackSecretSavedAckFromSession,
  markPaystackSecretSavedAckInSession,
  setPaystackSecretInSession,
} from "@/billing/lib/paystackSecretSessionCache";
import { cn } from "@/lib/utils";

type GatewayConfigRow = Tables<"tenant_payment_gateway_configs"> & {
  secret_key?: string;
  webhook_secret?: string;
  has_encrypted_secrets?: boolean;
  /** True when DB holds a secret even if `secret_key` is not returned to the client. */
  secret_key_is_stored?: boolean;
};

async function invokePaystackGatewayList(): Promise<GatewayConfigRow[]> {
  const { data, error } = await supabase.functions.invoke("paystack", {
    body: { action: "gateway-list" },
  });
  if (error) {
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const parsed = (await ctx.json()) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        /* keep msg */
      }
    }
    throw new Error(msg);
  }
  const body = data as { error?: string; gateways?: GatewayConfigRow[] };
  if (body?.error) throw new Error(body.error);
  return body.gateways ?? [];
}

const WEBHOOK_PATH = "/functions/v1/paystack/webhook";
/** Autosave debounce after typing stops (payment API keys). */
const PAYSTACK_AUTOSAVE_DEBOUNCE_MS = 2000;

const PROVIDERS = [
  { id: "paystack", label: "Paystack", implemented: true },
  { id: "flutterwave", label: "Flutterwave", implemented: false },
  { id: "stripe", label: "Stripe", implemented: false },
  { id: "paypal", label: "PayPal", implemented: false },
  { id: "mobile_money", label: "Mobile Money", implemented: false },
  { id: "bank_transfer", label: "Bank transfer (manual)", implemented: false },
] as const;

function statusBadge(status: string) {
  if (status === "connected") return <Badge className="bg-emerald-600">Connected</Badge>;
  if (status === "error") return <Badge variant="destructive">Error</Badge>;
  return <Badge variant="secondary">Disconnected</Badge>;
}

export default function PaymentGatewaySettings() {
  const { user } = useAuth();
  const { schoolId, isAdmin } = useBillingAuth();
  const qc = useQueryClient();
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const webhookUrl = `${baseUrl.replace(/\/$/, "")}${WEBHOOK_PATH}`;

  const canManage = isAdmin;

  const {
    data: configs = [],
    isLoading: loadingConfigs,
    error: gatewaysLoadError,
  } = useQuery({
    queryKey: ["tenant-payment-gateways", schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      return invokePaystackGatewayList();
    },
    enabled: !!schoolId && canManage,
    retry: 1,
  });

  const paystackConfig = useMemo(() => configs.find((c) => c.provider === "paystack") ?? null, [configs]);

  /** Bumps when gateway-list returns new row + decrypted secrets so fields re-sync from the server after save/refetch. */
  const paystackServerSyncKey = useMemo(() => {
    if (!paystackConfig) return "";
    return [
      paystackConfig.id,
      paystackConfig.updated_at ?? "",
      paystackConfig.public_key ?? "",
      paystackConfig.merchant_email ?? "",
      paystackConfig.is_enabled ? "1" : "0",
      paystackConfig.is_test_mode ? "1" : "0",
      paystackConfig.is_default ? "1" : "0",
      paystackConfig.secret_key ?? "",
      paystackConfig.webhook_secret ?? "",
    ].join("\0");
  }, [paystackConfig]);

  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [merchantEmail, setMerchantEmail] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [isTestMode, setIsTestMode] = useState(true);
  const [isDefault, setIsDefault] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  /** Re-render when sessionStorage secret changes (API may not return secret after save). */
  const [sessionSecretTick, setSessionSecretTick] = useState(0);

  /** Latest field values for debounced save (avoids stale closures and effect dependency churn). */
  const saveSnapshotRef = useRef({
    user: null as User | null,
    canManage: false,
    publicKey: "",
    secretKey: "",
    webhookSecret: "",
    merchantEmail: "",
    isEnabled: true,
    isTestMode: true,
    isDefault: true,
    paystackConfigId: undefined as string | undefined,
  });
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    saveSnapshotRef.current = {
      user,
      canManage,
      publicKey,
      secretKey,
      webhookSecret,
      merchantEmail,
      isEnabled,
      isTestMode,
      isDefault,
      paystackConfigId: paystackConfig?.id,
    };
  });

  // Hydrate from gateway-list (DB) + sessionStorage fallback for secret in this tab.
  useEffect(() => {
    if (!paystackConfig) {
      setPublicKey("");
      setMerchantEmail("");
      setIsEnabled(true);
      setIsTestMode(true);
      setIsDefault(true);
      setSecretKey("");
      setWebhookSecret("");
      return;
    }
    setPublicKey(paystackConfig.public_key ?? "");
    setMerchantEmail(paystackConfig.merchant_email ?? "");
    setIsEnabled(paystackConfig.is_enabled);
    setIsTestMode(paystackConfig.is_test_mode);
    setIsDefault(paystackConfig.is_default);
    const serverSk = (paystackConfig.secret_key ?? "").trim();
    if (schoolId && serverSk) {
      setPaystackSecretInSession(schoolId, serverSk);
    }
    const fromSession = schoolId ? getPaystackSecretFromSession(schoolId).trim() : "";
    setSecretKey(serverSk || fromSession || "");
    setWebhookSecret((prev) => {
      const server = (paystackConfig.webhook_secret ?? "").trim();
      if (server) return paystackConfig.webhook_secret ?? "";
      if (prev.trim()) return prev;
      return "";
    });
  }, [paystackServerSyncKey, paystackConfig, schoolId]);

  const publicKeyInvalid = publicKey.trim().length > 0 && !isValidPaystackPublicKey(publicKey.trim());
  const secretKeyInvalid = secretKey.trim().length > 0 && !isValidPaystackSecretKey(secretKey.trim());

  /** Server value when returned; otherwise this tab’s session copy (see paystackSecretSessionCache). */
  const displayedSavedSecret = useMemo(() => {
    const fromServer = paystackConfig?.secret_key?.trim() ?? "";
    if (fromServer) return fromServer;
    return schoolId ? getPaystackSecretFromSession(schoolId).trim() : "";
  }, [paystackConfig?.secret_key, schoolId, sessionSecretTick]);

  const secretKeyStoredOnServer = Boolean(paystackConfig?.secret_key_is_stored);

  const showSecretSavedSecurelyMessage = useMemo(() => {
    if (displayedSavedSecret) return false;
    if (secretKeyStoredOnServer) return true;
    if (schoolId && getPaystackSecretSavedAckFromSession(schoolId)) return true;
    return false;
  }, [displayedSavedSecret, secretKeyStoredOnServer, schoolId, sessionSecretTick]);

  const { data: recentPayments = [] } = useQuery({
    queryKey: ["tenant-payment-history", schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, currency, status, gateway, gateway_ref, paid_at, created_at, method")
        .eq("school_id", schoolId)
        .eq("gateway", "paystack")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId && canManage,
  });

  const { data: webhookLogs = [] } = useQuery({
    queryKey: ["payment-webhook-logs", schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("payment_webhook_logs")
        .select("*")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId && canManage,
  });

  const performPaystackSave = useCallback(
    async (opts?: { silent?: boolean }) => {
      const s = saveSnapshotRef.current;
      if (loadingConfigs || !s.user || !s.canManage) return;
      const pk = s.publicKey.trim();
      if (!pk) return;
      if (!isValidPaystackPublicKey(pk)) {
        if (!opts?.silent) toast.error(PAYSTACK_PUBLIC_KEY_HINT);
        return;
      }
      const skTrim = s.secretKey.trim();
      const secretFormatOk = !skTrim || isValidPaystackSecretKey(skTrim);
      if (skTrim && !secretFormatOk) {
        if (!opts?.silent) toast.error(PAYSTACK_SECRET_KEY_HINT);
      }

      setSaving(true);
      try {
        const payload: Record<string, unknown> = {
          action: "gateway-upsert",
          provider: "paystack",
          is_enabled: s.isEnabled,
          is_test_mode: s.isTestMode,
          is_default: s.isDefault,
          public_key: pk,
          merchant_email: s.merchantEmail.trim() || null,
          callback_url: null,
        };
        if (s.paystackConfigId) payload.id = s.paystackConfigId;
        if (skTrim && secretFormatOk) payload.secret_key = skTrim;
        if (s.webhookSecret.trim()) payload.webhook_secret = s.webhookSecret.trim();

        const { data, error } = await supabase.functions.invoke("paystack", { body: payload });
        if (error) throw new Error(error.message);
        const body = data as { error?: string; ok?: boolean };
        if (body?.error) throw new Error(body.error);
        if (schoolId) {
          await qc.refetchQueries({ queryKey: ["tenant-payment-gateways", schoolId] });
          if (skTrim && secretFormatOk) {
            setPaystackSecretInSession(schoolId, skTrim);
            markPaystackSecretSavedAckInSession(schoolId);
            setSessionSecretTick((t) => t + 1);
          }
        }
        if (!opts?.silent) toast.success("Paystack settings saved");
        else toast.success("Saved", { duration: 2000 });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [loadingConfigs, qc, schoolId],
  );

  const schedulePaystackAutosave = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      const snap = saveSnapshotRef.current;
      const pk = snap.publicKey.trim();
      if (!pk || !isValidPaystackPublicKey(pk)) return;
      void performPaystackSave({ silent: true });
    }, PAYSTACK_AUTOSAVE_DEBOUNCE_MS);
  }, [performPaystackSave]);

  useEffect(
    () => () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    },
    [],
  );

  const testPaystack = async () => {
    if (!user || !canManage) return;
    setTesting(true);
    try {
      const payload: Record<string, unknown> = {
        action: "gateway-test",
        provider: "paystack",
      };
      if (secretKey.trim()) {
        if (!isValidPaystackSecretKey(secretKey.trim())) {
          toast.error(PAYSTACK_SECRET_KEY_HINT);
          return;
        }
        payload.secret_key = secretKey.trim();
      } else if (paystackConfig?.id) payload.gateway_config_id = paystackConfig.id;
      else throw new Error("Enter a secret key or save credentials first");

      const { data, error } = await supabase.functions.invoke("paystack", { body: payload });
      if (error) throw new Error(error.message);
      const body = data as { ok?: boolean; error?: string };
      if (body?.error) throw new Error(body.error);
      if (body?.ok) toast.success("Paystack credentials verified");
      else toast.error("Verification failed");
      if (schoolId) await qc.refetchQueries({ queryKey: ["tenant-payment-gateways", schoolId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  };

  if (!canManage) {
    return (
      <div className="max-w-2xl space-y-4">
        <p className="text-muted-foreground">Only school administrators can manage payment gateways.</p>
        <Button variant="outline" asChild>
          <Link to="/admin/billing/settings">Back to settings</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-1 w-fit gap-1" asChild>
            <Link to="/admin/billing/settings">
              <ArrowLeft className="h-4 w-4" />
              Settings
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Payment gateways</h1>
          <p className="text-sm text-muted-foreground">
            Connect your school&apos;s own processor. Funds settle in your merchant account, not a shared platform wallet.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            API keys auto-save about {PAYSTACK_AUTOSAVE_DEBOUNCE_MS / 1000} seconds after you stop typing. Keys are encrypted at
            rest; org admins can reload them from the server. This tab may keep the secret in session storage for display until
            you close it.
          </span>
        </div>
      </div>

      {gatewaysLoadError instanceof Error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <p className="font-medium text-destructive">Could not load saved payment keys</p>
          <p className="mt-1 whitespace-pre-wrap text-destructive/90">{gatewaysLoadError.message}</p>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5" />
              Paystack
            </CardTitle>
            <CardDescription>
              Money from parent and student checkout always goes to this school&apos;s Paystack account. Add this webhook URL in
              Paystack so invoices update when payment succeeds:{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs break-all">{webhookUrl}</code>
            </CardDescription>
          </div>
          {paystackConfig ? statusBadge(paystackConfig.connection_status) : statusBadge("disconnected")}
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingConfigs ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-sm font-medium">Gateway enabled</Label>
                    <p className="text-xs text-muted-foreground">Allow online checkout with Paystack</p>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(v) => {
                      setIsEnabled(v);
                      saveSnapshotRef.current = { ...saveSnapshotRef.current, isEnabled: v };
                      schedulePaystackAutosave();
                    }}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-sm font-medium">Test mode</Label>
                    <p className="text-xs text-muted-foreground">Use test keys from Paystack</p>
                  </div>
                  <Switch
                    checked={isTestMode}
                    onCheckedChange={(v) => {
                      setIsTestMode(v);
                      saveSnapshotRef.current = { ...saveSnapshotRef.current, isTestMode: v };
                      schedulePaystackAutosave();
                    }}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                  <div>
                    <Label className="text-sm font-medium">Default for this school</Label>
                    <p className="text-xs text-muted-foreground">Used for student and parent checkout</p>
                  </div>
                  <Switch
                    checked={isDefault}
                    onCheckedChange={(v) => {
                      setIsDefault(v);
                      saveSnapshotRef.current = { ...saveSnapshotRef.current, isDefault: v };
                      schedulePaystackAutosave();
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Public key</Label>
                  <Input
                    value={publicKey}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPublicKey(v);
                      saveSnapshotRef.current = { ...saveSnapshotRef.current, publicKey: v };
                      schedulePaystackAutosave();
                    }}
                    placeholder="pk_test_..."
                    autoComplete="off"
                    aria-invalid={publicKeyInvalid}
                    className={publicKeyInvalid ? "border-destructive" : undefined}
                  />
                  {publicKeyInvalid ? (
                    <p className="text-xs text-destructive">{PAYSTACK_PUBLIC_KEY_HINT}</p>
                  ) : null}
                  <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">Saved public key</p>
                    <code className="mt-1 block break-all font-mono text-xs text-foreground">
                      {paystackConfig?.public_key?.trim() ? paystackConfig.public_key : "— not saved yet —"}
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Auto-saves about {PAYSTACK_AUTOSAVE_DEBOUNCE_MS / 1000}s after typing stops. Use{" "}
                    <span className="font-mono">pk_test_</span> or <span className="font-mono">pk_live_</span> only in this field.
                  </p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Secret key</Label>
                  <Input
                    value={secretKey}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSecretKey(v);
                      saveSnapshotRef.current = { ...saveSnapshotRef.current, secretKey: v };
                      schedulePaystackAutosave();
                    }}
                    placeholder="sk_test_..."
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={secretKeyInvalid}
                    className={cn("font-mono text-sm", secretKeyInvalid && "border-destructive")}
                  />
                  {secretKeyInvalid ? (
                    <p className="text-xs text-destructive">{PAYSTACK_SECRET_KEY_HINT}</p>
                  ) : null}
                  <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">Saved secret key</p>
                    {displayedSavedSecret ? (
                      <p className="mt-1 whitespace-pre-wrap break-all font-mono text-sm leading-relaxed text-foreground">
                        {displayedSavedSecret}
                      </p>
                    ) : showSecretSavedSecurelyMessage ? (
                      <p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        Secret key has been saved secretly — kept on the server; not shown here.
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">— not saved yet —</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Auto-saves about {PAYSTACK_AUTOSAVE_DEBOUNCE_MS / 1000}s after typing stops when the format is valid.{" "}
                    <span className="font-mono">sk_test_</span> or <span className="font-mono">sk_live_</span> only. When the server
                    sends it back, it appears above; otherwise you still get confirmation once it is stored.
                  </p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Webhook secret (optional)</Label>
                  <Input
                    value={webhookSecret}
                    onChange={(e) => {
                      const v = e.target.value;
                      setWebhookSecret(v);
                      saveSnapshotRef.current = { ...saveSnapshotRef.current, webhookSecret: v };
                      schedulePaystackAutosave();
                    }}
                    placeholder="If set, used for HMAC verification"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-saves shortly after you stop typing when you change it (optional).
                  </p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Merchant email (optional)</Label>
                  <Input
                    value={merchantEmail}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMerchantEmail(v);
                      saveSnapshotRef.current = { ...saveSnapshotRef.current, merchantEmail: v };
                      schedulePaystackAutosave();
                    }}
                    placeholder="finance@school.edu"
                    type="email"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void performPaystackSave()} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Paystack
                </Button>
                <Button type="button" variant="outline" onClick={testPaystack} disabled={testing}>
                  {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Test connection
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {PROVIDERS.filter((p) => p.id !== "paystack").map((p) => (
          <Card key={p.id} className={p.implemented ? "" : "opacity-80"}>
            <CardHeader>
              <CardTitle className="text-base">{p.label}</CardTitle>
              <CardDescription>
                {p.implemented ? "Configure credentials" : "Coming soon — schema and UI reserved for this provider."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!p.implemented ? (
                <Badge variant="outline">Planned</Badge>
              ) : (
                <Button size="sm" variant="secondary">
                  Configure
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Paystack transactions</CardTitle>
            <CardDescription>Validated, tenant-scoped payment rows</CardDescription>
          </CardHeader>
          <CardContent className="max-h-80 overflow-auto text-sm">
            {recentPayments.length === 0 ? (
              <p className="text-muted-foreground">No Paystack payments yet.</p>
            ) : (
              <ul className="space-y-2">
                {recentPayments.map((row) => (
                  <li key={row.id} className="flex flex-wrap justify-between gap-2 border-b border-border/60 py-2 last:border-0">
                    <span className="font-medium">
                      {row.currency} {Number(row.amount).toFixed(2)}
                    </span>
                    <span className="text-muted-foreground">{row.status}</span>
                    <span className="w-full truncate text-xs text-muted-foreground">{row.gateway_ref}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Webhook activity</CardTitle>
            <CardDescription>Signature verification and processing trail</CardDescription>
          </CardHeader>
          <CardContent className="max-h-80 overflow-auto text-sm">
            {webhookLogs.length === 0 ? (
              <p className="text-muted-foreground">No webhook calls logged yet.</p>
            ) : (
              <ul className="space-y-2">
                {webhookLogs.map((row) => (
                  <li key={row.id} className="border-b border-border/60 py-2 last:border-0">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span>{row.event_type ?? row.provider}</span>
                      <Badge variant={row.signature_valid ? "default" : "destructive"} className="text-xs">
                        {row.processing_status}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{row.reference}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

