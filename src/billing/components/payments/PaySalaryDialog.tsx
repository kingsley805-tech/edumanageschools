// @ts-nocheck
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Banknote, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface StaffMember {
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
}

export default function PaySalaryDialog() {
  const { user } = useAuth();
  const { schoolId } = useBillingAuth();
  const [open, setOpen] = useState(false);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [notes, setNotes] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (!open || !schoolId) return;
    fetchStaff();
  }, [open, schoolId]);

  const fetchStaff = async () => {
    if (!schoolId) return;
    // Get profiles in this org
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("school_id", schoolId);

    if (!profiles?.length) return;

    const userIds = profiles.map((p) => p.id);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    const staffRoles = new Set(["teacher", "accountant", "admin"]);
    const roleMap = new Map<string, string>();
    (roles || []).forEach((r) => {
      if (staffRoles.has(r.role)) roleMap.set(r.user_id, r.role);
    });

    const staff = profiles
      .filter((p) => roleMap.has(p.id))
      .map((p) => {
        const parts = (p.full_name ?? "").trim().split(/\s+/);
        return {
          user_id: p.id,
          first_name: parts[0] ?? "",
          last_name: parts.slice(1).join(" ") ?? "",
          role: roleMap.get(p.id) || "",
        };
      });

    setStaffMembers(staff);
  };

  const handlePay = async () => {
    if (!selectedStaff || !amount || !month || !schoolId || !user) return;
    setLoading(true);

    try {
      const salaryPayload = {
        school_id: schoolId,
        staff_user_id: selectedStaff,
        amount: parseFloat(amount),
        month,
        method,
        status: method === "paystack" ? "processing" : "paid",
        gateway: method === "paystack" ? "paystack" : "manual",
        paid_at: method !== "paystack" ? new Date().toISOString() : null,
        notes: notes || null,
        recorded_by: user.id,
      };

      const { data: salary, error } = await supabase
        .from("staff_salaries")
        .insert(salaryPayload)
        .select("id")
        .single();

      if (error) throw error;

      if (method === "paystack") {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session?.access_token) throw new Error("Please sign in again.");
        if (!salary?.id) throw new Error("Salary record not found");

        const { data: transferData, error: transferErr } = await supabase.functions.invoke("paystack", {
          body: {
            action: "transfer",
            salary_id: salary.id,
            amount: parseFloat(amount),
            staff_user_id: selectedStaff,
            month,
            description: notes || `Salary for ${month}`,
            bank_code: bankCode || undefined,
            account_number: accountNumber || undefined,
            account_name: accountName || undefined,
          },
        });

        if (transferErr) {
          throw new Error(transferErr.message || "Unable to complete transfer");
        }
        const td = transferData as { success?: boolean; error?: string } | null;
        if (!td?.success) {
          throw new Error(typeof td?.error === "string" ? td.error : "Unable to complete transfer");
        }
      }

      toast.success(method === "paystack" ? "Salary paid via Paystack" : "Salary payment recorded");
      qc.invalidateQueries({ queryKey: ["staff-salaries"] });
      setOpen(false);
      setSelectedStaff("");
      setAmount("");
      setMonth("");
      setNotes("");
      setBankCode("");
      setAccountNumber("");
      setAccountName("");
    } catch (err: any) {
      toast.error(err.message || "Failed to record salary");
    } finally {
      setLoading(false);
    }
  };

  // Generate month options
  const now = new Date();
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { year: "numeric", month: "long" }),
    };
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Banknote className="mr-2 h-4 w-4" />
          Pay Salary
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Salary Payment</DialogTitle>
          <DialogDescription>
            Record a salary payment for staff. Choose bank transfer, cash, mobile money, or Paystack.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Staff Member</Label>
            <Select value={selectedStaff} onValueChange={setSelectedStaff}>
              <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
              <SelectContent>
                {staffMembers.length === 0 ? (
                  <SelectItem value="none" disabled>No staff members found</SelectItem>
                ) : staffMembers.map((s) => (
                  <SelectItem key={s.user_id} value={s.user_id}>
                    {s.first_name} {s.last_name} ({s.role === "class_teacher" ? "Teacher" : "Accountant"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Amount (GHS)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 2500.00"
            />
          </div>
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                <SelectItem value="paystack">Paystack</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {method === "paystack" && (
            <>
              <div className="space-y-2">
                <Label>Bank Code</Label>
                <Input
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  placeholder="e.g. 058"
                />
              </div>
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 0123456789"
                />
              </div>
              <div className="space-y-2">
                <Label>Account Name (optional)</Label>
                <Input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Teacher account name"
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. March salary, bonus included"
            />
          </div>
          <Button
            onClick={handlePay}
            disabled={loading || !selectedStaff || !amount || !month}
            className="w-full"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}
            Record Payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}