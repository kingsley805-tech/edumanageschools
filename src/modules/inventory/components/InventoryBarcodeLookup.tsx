import { useState } from "react";
import { ScanLine, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { lookupItemByCode } from "@/modules/inventory/lib/api";
import type { InventoryItem } from "@/modules/inventory/lib/types";
import { toast } from "sonner";
import { isElectronDesktop, useBarcodeScan } from "@/desktop";

type Props = {
  schoolId: string | null;
  onItemFound?: (item: InventoryItem) => void;
};

function statusBadge(status: InventoryItem["item_status"]) {
  const map = {
    available: { label: "Available", variant: "default" as const, className: "bg-emerald-600/90" },
    low_stock: { label: "Low Stock", variant: "destructive" as const, className: "" },
    out_of_stock: { label: "Out of Stock", variant: "destructive" as const, className: "" },
    discontinued: { label: "Discontinued", variant: "secondary" as const, className: "" },
  };
  const s = map[status];
  return (
    <Badge variant={s.variant} className={s.className}>
      {s.label}
    </Badge>
  );
}

export function InventoryBarcodeLookup({ schoolId, onItemFound }: Props) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(false);

  const lookup = async (rawCode?: string) => {
    const candidate = (rawCode ?? code).trim();
    if (!schoolId || !candidate) {
      toast.error("Enter a SKU or barcode.");
      return;
    }
    setLoading(true);
    try {
      const item = await lookupItemByCode(schoolId, candidate);
      if (!item) {
        toast.error("No item found for this code.");
        setResult(null);
        return;
      }
      setResult(item);
      onItemFound?.(item);
      toast.success(`Found: ${item.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  // Hardware scans broadcast over Electron IPC (e.g. a scanner wired through
  // a serial port rather than HID keyboard emulation) look up immediately
  // regardless of which control has focus.
  useBarcodeScan(
    (scan) => {
      if (!scan?.value) return;
      setCode(scan.value);
      void lookup(scan.value);
    },
    [schoolId],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanLine className="h-4 w-4" />
          Barcode / SKU Lookup
          {isElectronDesktop() && (
            <Badge variant="outline" className="ml-1 gap-1 text-[10px] font-normal text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Hardware scanner ready
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Scan or enter SKU/barcode for fast stock identification and audits</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 font-mono"
              placeholder="SKU or barcode…"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void lookup()}
            />
          </div>
          <Button onClick={() => void lookup()} disabled={loading}>
            {loading ? "Searching…" : "Lookup"}
          </Button>
        </div>
        {result ? (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{result.name}</p>
              {statusBadge(result.item_status)}
            </div>
            <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
              <p>SKU: <span className="font-mono text-foreground">{result.sku ?? "—"}</span></p>
              <p>Barcode: <span className="font-mono text-foreground">{result.barcode ?? "—"}</span></p>
              <p>Category: {result.category ?? "—"}</p>
              <p>Location: {result.location ?? "—"}</p>
              <p>Stock: <span className="font-medium text-foreground">{result.quantity} {result.unit}</span></p>
              <p>Unit cost: {result.unit_cost.toLocaleString()}</p>
            </div>
            {result.sku || result.barcode ? (
              <div className="mt-3 rounded border bg-background p-3 text-center">
                <p className="mb-1 text-xs text-muted-foreground">Printable label code</p>
                <p className="font-mono text-lg font-bold tracking-widest">{result.barcode || result.sku}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
