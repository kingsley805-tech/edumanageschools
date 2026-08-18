import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhoneOutgoing, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { triggerOutboundCall } from "@/modules/ai-receptionist/lib/api";
import { OUTBOUND_PURPOSES } from "@/modules/ai-receptionist/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string | null;
  onSuccess: () => void;
};

export function AiReceptionistOutboundModal({
  open,
  onOpenChange,
  schoolId,
  onSuccess,
}: Props) {
  const [recipientName, setRecipientName] = useState("");
  const [toPhone, setToPhone] = useState("");
  const [purpose, setPurpose] = useState("fee_reminder");
  const [context, setContext] = useState(
    OUTBOUND_PURPOSES[0]?.defaultContext || "Reminder regarding school fee payment.",
  );
  const [loading, setLoading] = useState(false);

  const handlePurposeChange = (val: string) => {
    setPurpose(val);
    const match = OUTBOUND_PURPOSES.find((p) => p.value === val);
    if (match) {
      setContext(match.defaultContext);
    }
  };

  const handleTriggerCall = async () => {
    if (!schoolId) {
      toast.error("School context is required");
      return;
    }
    if (!toPhone.trim()) {
      toast.error("Recipient phone number is required");
      return;
    }

    setLoading(true);
    try {
      const result = await triggerOutboundCall({
        schoolId,
        toPhone: toPhone.trim(),
        recipientName: recipientName.trim() || undefined,
        purpose,
        context: context.trim() || undefined,
      });

      if (result.ok) {
        toast.success("Outbound AI call initiated! Connecting to customer...");
        onOpenChange(false);
        onSuccess();
        // Reset form
        setToPhone("");
        setRecipientName("");
      } else {
        toast.error(result.message || "Failed to initiate call");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Could not dispatch outbound call.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <PhoneOutgoing className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Launch Outbound AI Call</DialogTitle>
              <DialogDescription className="text-xs">
                Dispatch the voice assistant to call a parent with a customized notification
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Recipient Name</Label>
              <Input
                placeholder="e.g. Mr. John Mensah"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Phone Number (E.164)</Label>
              <Input
                placeholder="+233241234567"
                value={toPhone}
                onChange={(e) => setToPhone(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Call Campaign / Purpose</Label>
            <Select value={purpose} onValueChange={handlePurposeChange}>
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTBOUND_PURPOSES.map((p) => (
                  <SelectItem key={p.value} value={p.value} className="text-xs">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">AI Briefing Context</Label>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" /> Injected into prompt
              </span>
            </div>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              placeholder="e.g. Inform the parent that 150 GHS balance is due for Term 2. Student: Kwesi Mensah."
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void handleTriggerCall()} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PhoneOutgoing className="h-3.5 w-3.5" />}
            {loading ? "Calling…" : "Start Call"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
