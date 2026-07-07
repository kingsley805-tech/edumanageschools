import { useRef, useState } from "react";
import { Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recordHostelPayment } from "@/modules/hostel/lib/api";
import type { HostelAllocation, HostelPayment } from "@/modules/hostel/lib/types";
import { formatMoney } from "@/lib/currency";
import { toast } from "sonner";

type Access = { canCreate: boolean; canEdit: boolean; canDelete: boolean };

type Props = {
  payments: HostelPayment[];
  allocations: HostelAllocation[];
  access: Access;
  onRefresh: () => void;
  schoolId: string | null;
};

type ReceiptData = {
  receipt_number: string;
  student_name: string;
  admission_number: string;
  hostel_name: string;
  room_number: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  notes: string | null;
};

export function HostelFeesPanel({ payments, allocations, access, onRefresh, schoolId }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    allocation_id: "",
    amount: "",
    payment_method: "cash",
    payment_date: new Date().toISOString().slice(0, 10),
    receipt_number: "",
    notes: "",
  });

  const activeAllocations = allocations.filter((a) => a.allocation_status !== "checked_out");

  const selectedAllocation = activeAllocations.find((a) => a.id === form.allocation_id);
  const balance = selectedAllocation
    ? Math.max(0, selectedAllocation.fee_amount - selectedAllocation.amount_paid)
    : 0;

  const handleRecord = async () => {
    if (!form.allocation_id || !form.amount || Number(form.amount) <= 0) {
      toast.error("Select an allocation and enter a valid amount.");
      return;
    }
    setSaving(true);
    try {
      const result = await recordHostelPayment({
        allocation_id: form.allocation_id,
        amount: Number(form.amount),
        payment_method: form.payment_method,
        payment_date: form.payment_date,
        receipt_number: form.receipt_number || undefined,
        notes: form.notes || undefined,
      });
      const alloc = selectedAllocation!;
      const receiptData: ReceiptData = {
        receipt_number: result.receipt_number ?? form.receipt_number ?? `RCP-${Date.now()}`,
        student_name: alloc.student_name,
        admission_number: alloc.admission_number,
        hostel_name: alloc.hostel_name,
        room_number: alloc.room_number,
        amount: Number(form.amount),
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        notes: form.notes || null,
      };
      toast.success("Payment recorded");
      setOpen(false);
      setForm({
        allocation_id: "",
        amount: "",
        payment_method: "cash",
        payment_date: new Date().toISOString().slice(0, 10),
        receipt_number: "",
        notes: "",
      });
      setReceipt(receiptData);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  const printReceipt = (data: ReceiptData) => {
    setReceipt(data);
    requestAnimationFrame(() => {
      window.print();
    });
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #hostel-receipt-print, #hostel-receipt-print * { visibility: visible; }
          #hostel-receipt-print { position: absolute; left: 0; top: 0; width: 100%; padding: 2rem; }
        }
      `}</style>

      <div id="hostel-receipt-print" ref={receiptRef} className="hidden print:block">
        {receipt ? (
          <div className="mx-auto max-w-md space-y-4 font-mono text-sm">
            <h2 className="text-center text-lg font-bold">Hostel Payment Receipt</h2>
            <p className="text-center text-muted-foreground">Receipt #{receipt.receipt_number}</p>
            <hr />
            <p><strong>Student:</strong> {receipt.student_name}</p>
            <p><strong>Admission:</strong> {receipt.admission_number}</p>
            <p><strong>Hostel:</strong> {receipt.hostel_name} — Room {receipt.room_number}</p>
            <p><strong>Amount:</strong> {formatMoney(receipt.amount)}</p>
            <p><strong>Date:</strong> {receipt.payment_date}</p>
            <p><strong>Method:</strong> {receipt.payment_method}</p>
            {receipt.notes ? <p><strong>Notes:</strong> {receipt.notes}</p> : null}
            <hr />
            <p className="text-center text-xs text-muted-foreground">Thank you for your payment</p>
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Hostel Fees</CardTitle>
            <CardDescription>Record payments and print receipts.</CardDescription>
          </div>
          {access.canCreate ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Record payment
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Record hostel payment</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Student allocation</Label>
                    <Select value={form.allocation_id} onValueChange={(v) => setForm({ ...form, allocation_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                      <SelectContent>
                        {activeAllocations.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.student_name} — {a.hostel_name} / {a.room_number} (bal: {formatMoney(a.fee_amount - a.amount_paid)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedAllocation ? (
                    <p className="text-xs text-muted-foreground">
                      Outstanding balance: {formatMoney(balance)}
                    </p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Amount</Label>
                      <Input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Date</Label>
                      <Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Method</Label>
                      <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                          <SelectItem value="mobile_money">Mobile money</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Receipt #</Label>
                      <Input value={form.receipt_number} onChange={(e) => setForm({ ...form, receipt_number: e.target.value })} placeholder="Auto" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                  </div>
                  <Button onClick={() => void handleRecord()} disabled={saving || !schoolId}>
                    {saving ? "Recording…" : "Record payment"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Admission</TableHead>
                <TableHead>Hostel</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.payment_date}</TableCell>
                  <TableCell className="font-mono text-xs">{p.receipt_number ?? "—"}</TableCell>
                  <TableCell className="font-medium">{p.student_name}</TableCell>
                  <TableCell>{p.admission_number}</TableCell>
                  <TableCell>{p.hostel_name}</TableCell>
                  <TableCell>{p.room_number}</TableCell>
                  <TableCell>{formatMoney(p.amount)}</TableCell>
                  <TableCell className="capitalize">{p.payment_method.replace("_", " ")}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Print receipt"
                      onClick={() =>
                        printReceipt({
                          receipt_number: p.receipt_number ?? p.id.slice(0, 8),
                          student_name: p.student_name,
                          admission_number: p.admission_number,
                          hostel_name: p.hostel_name,
                          room_number: p.room_number,
                          amount: p.amount,
                          payment_date: p.payment_date,
                          payment_method: p.payment_method,
                          notes: p.notes,
                        })
                      }
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
