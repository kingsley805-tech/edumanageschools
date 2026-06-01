// @ts-nocheck
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useSubscriptionPaymentHistory } from "@/subscription/hooks/useOrganizationSubscription";

export default function OrganizationSubscriptionHistoryPage() {
  const { data: payments = [], isLoading } = useSubscriptionPaymentHistory();

  return (
    <DashboardLayout role="admin" hideSidebar>
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/subscription">
            <ArrowLeft className="mr-1 h-4 w-4" /> Subscription
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Subscription payment history</h1>
          <p className="text-muted-foreground">Platform subscription payments for your organization</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subscription payments yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {p.paid_at ? new Date(p.paid_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>{p.subscription_plans?.name ?? "—"}</TableCell>
                      <TableCell className="capitalize">{p.billing_cycle}</TableCell>
                      <TableCell>GHS {Number(p.amount).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs">{p.payment_reference}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "completed" ? "default" : "secondary"}>
                          {p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Button variant="outline" asChild>
          <Link to="/admin/support">Need help? Contact support</Link>
        </Button>
      </div>
    </DashboardLayout>
  );
}
