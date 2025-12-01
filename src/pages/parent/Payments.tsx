import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

interface Invoice {
  id: string;
  invoice_no: string;
  amount: number;
  status: string;
  due_date: string;
  created_at: string;
  fee_structures: { name: string };
}

const Payments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!user) return;

      const { data: parentData } = await supabase
        .from("parents")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!parentData) return;

      const { data: studentsData } = await supabase
        .from("students")
        .select("id")
        .eq("guardian_id", parentData.id);

      if (!studentsData || studentsData.length === 0) return;

      const studentIds = studentsData.map(s => s.id);

      const { data } = await supabase
        .from("invoices")
        .select("*, fee_structures(name)")
        .in("student_id", studentIds)
        .order("created_at", { ascending: false });

      setInvoices((data as any) || []);
    };

    fetchInvoices();
  }, [user]);

  const handlePayment = async (invoice: Invoice) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-payment-intent", {
        body: { invoiceId: invoice.id, amount: invoice.amount }
      });

      if (error) throw error;

      toast({ 
        title: "Payment initiated", 
        description: `Payment for $${invoice.amount} is being processed. This is a demo - in production, Stripe Elements would be used for card entry.`
      });

      // In production, you would use Stripe Elements here to collect card details
      // For now, just refresh the invoices
      const { data: updatedInvoices } = await supabase
        .from("invoices")
        .select("*, fee_structures(name)")
        .order("created_at", { ascending: false });
      setInvoices((updatedInvoices as any) || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="parent">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Fee Payments</h2>
          <p className="text-muted-foreground">View and manage fee payments</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>Track all fee payments and pending invoices</CardDescription>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-4">
                  <DollarSign className="h-16 w-16 text-muted-foreground mx-auto" />
                  <p className="text-lg font-medium">No invoices</p>
                  <p className="text-sm text-muted-foreground">Your child's fee payment records will appear here</p>
                </div>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice No</TableHead>
                      <TableHead>Fee Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoice_no}</TableCell>
                        <TableCell>{invoice.fee_structures?.name}</TableCell>
                        <TableCell>${invoice.amount.toLocaleString()}</TableCell>
                        <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant={invoice.status === "paid" ? "default" : "destructive"}>
                            {invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {invoice.status !== "paid" && (
                            <Button 
                              size="sm" 
                              onClick={() => handlePayment(invoice)}
                              disabled={loading}
                            >
                              Pay Now
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Payments;
