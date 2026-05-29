import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Download, Eye, Printer } from "lucide-react";
import {
  PAYMENT_STATUS_BADGE,
  formatGateway,
  formatPaymentMethod,
  paymentDisplayDate,
  txnId,
  type PaymentTransactionRow,
} from "@/billing/lib/paymentTransactions";

export type PaymentTableVariant = "admin" | "student" | "parent";

type Props = {
  variant: PaymentTableVariant;
  rows: PaymentTransactionRow[];
  loading?: boolean;
  onView?: (row: PaymentTransactionRow) => void;
  onDownloadReceipt?: (row: PaymentTransactionRow) => void;
  onPrint?: (row: PaymentTransactionRow) => void;
  emptyMessage?: string;
};

export default function PaymentTransactionsTable({
  variant,
  rows,
  loading,
  onView,
  onDownloadReceipt,
  onPrint,
  emptyMessage = "No payment transactions yet.",
}: Props) {
  if (loading) {
    return (
      <div className="flex justify-center py-12 text-sm text-muted-foreground">
        Loading transactions…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {variant === "parent" ? <TableHead>Child</TableHead> : null}
            {variant === "admin" ? (
              <>
                <TableHead>Student</TableHead>
                <TableHead>Parent</TableHead>
              </>
            ) : null}
            <TableHead>Amount</TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead>Reference</TableHead>
            {variant === "admin" ? <TableHead>Txn ID</TableHead> : null}
            <TableHead>Gateway</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const st = PAYMENT_STATUS_BADGE[row.status] ?? PAYMENT_STATUS_BADGE.pending;
            return (
              <TableRow key={row.id}>
                {variant === "parent" ? (
                  <TableCell className="font-medium">{row.child_name ?? row.student_name ?? "—"}</TableCell>
                ) : null}
                {variant === "admin" ? (
                  <>
                    <TableCell>{row.student_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{row.parent_name ?? "—"}</TableCell>
                  </>
                ) : null}
                <TableCell className="font-semibold whitespace-nowrap">
                  {row.currency} {Number(row.amount).toLocaleString()}
                </TableCell>
                <TableCell>{row.invoice_number ?? "—"}</TableCell>
                <TableCell className="max-w-[120px] truncate font-mono text-xs" title={row.gateway_ref ?? ""}>
                  {row.gateway_ref ?? "—"}
                </TableCell>
                {variant === "admin" ? (
                  <TableCell className="max-w-[100px] truncate font-mono text-xs">{txnId(row)}</TableCell>
                ) : null}
                <TableCell>{formatGateway(row.gateway)}</TableCell>
                <TableCell>{formatPaymentMethod(row.method)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("text-xs", st.className)}>
                    {st.label}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {paymentDisplayDate(row)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {onView ? (
                      <Button variant="ghost" size="icon" onClick={() => onView(row)} title="View">
                        <Eye className="h-4 w-4" />
                      </Button>
                    ) : null}
                    {onPrint ? (
                      <Button variant="ghost" size="icon" onClick={() => onPrint(row)} title="Print">
                        <Printer className="h-4 w-4" />
                      </Button>
                    ) : null}
                    {onDownloadReceipt ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDownloadReceipt(row)}
                        title="Download receipt"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
