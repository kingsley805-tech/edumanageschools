// @ts-nocheck
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Check, X } from "lucide-react";
import { getRegister, reviewRegister } from "@/register/lib/api";
import { RegisterStatusBadge } from "@/register/components/RegisterStatusBadge";

export default function AdminRegisterReview() {
  const { id } = useParams();
  const [register, setRegister] = useState(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!id) return;
    void getRegister(id).then(setRegister);
  }, [id]);

  const review = async (action: "approve" | "reject") => {
    try {
      await reviewRegister(id!, action, feedback || undefined);
      toast.success(action === "approve" ? "Approved" : "Rejected");
      setRegister(await getRegister(id!));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (!register) {
    return (
      <DashboardLayout role="admin">
        <p className="text-muted-foreground py-12 text-center">Loading register…</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 max-w-5xl">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/register">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {register.classes?.name} · {register.subjects?.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {register.teachers?.profiles?.full_name} · {new Date(register.register_date).toLocaleDateString("en-GB")}
            </p>
          </div>
          <RegisterStatusBadge status={register.status} />
        </div>

        {register.status === "submitted" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Admin review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea placeholder="Feedback (optional)" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
              <div className="flex gap-2">
                <Button onClick={() => void review("approve")}>
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button variant="destructive" onClick={() => void review("reject")}>
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time in</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {register.entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.students?.profiles?.full_name}</TableCell>
                    <TableCell className="capitalize">{e.attendance_status}</TableCell>
                    <TableCell>{e.time_in?.slice(0, 5) ?? "—"}</TableCell>
                    <TableCell>{e.remarks ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {register.lesson_summary ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lesson summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{register.lesson_summary}</p>
              {register.homework ? (
                <p className="text-sm text-muted-foreground mt-3">
                  <strong>Homework:</strong> {register.homework}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
