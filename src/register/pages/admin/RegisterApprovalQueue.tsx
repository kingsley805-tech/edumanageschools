// @ts-nocheck
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { listRegisters, reviewRegister } from "@/register/lib/api";
import { RegisterStatusBadge } from "@/register/components/RegisterStatusBadge";
import { Check, X, Eye } from "lucide-react";

export function RegisterApprovalQueue({ schoolId, embedded }: { schoolId: string; embedded?: boolean }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listRegisters({ schoolId, status: "submitted" }));
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReview = async (id: string, action: "approve" | "reject") => {
    try {
      const comment = action === "reject" ? "Please correct and resubmit." : undefined;
      await reviewRegister(id, action, comment);
      toast.success(action === "approve" ? "Register approved" : "Register rejected");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Review failed");
    }
  };

  const content = (
    <div className={embedded ? "" : "space-y-4"}>
      {!embedded ? <h2 className="text-xl font-semibold">Approval queue</h2> : null}
      {loading ? (
        <p className="text-muted-foreground py-8 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center rounded-lg border border-dashed">No registers pending approval.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.classes?.name}</TableCell>
                  <TableCell>{r.subjects?.name}</TableCell>
                  <TableCell>{r.teachers?.profiles?.full_name}</TableCell>
                  <TableCell>{new Date(r.register_date).toLocaleDateString("en-GB")}</TableCell>
                  <TableCell>
                    <RegisterStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/admin/register/${r.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button size="sm" onClick={() => void handleReview(r.id, "approve")}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => void handleReview(r.id, "reject")}>
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );

  return content;
}
