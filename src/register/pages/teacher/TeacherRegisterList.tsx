// @ts-nocheck
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchSchoolId, fetchTeacherId, listRegisters } from "@/register/lib/api";
import { RegisterStatusBadge } from "@/register/components/RegisterStatusBadge";

export default function TeacherRegisterList() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const sid = await fetchSchoolId(user.id);
      const tid = await fetchTeacherId(user.id);
      if (!sid || !tid) return;
      setRows(await listRegisters({ schoolId: sid, teacherId: tid, limit: 30 }));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Class registers</h1>
            <p className="text-sm text-muted-foreground">Daily attendance and lesson records</p>
          </div>
          <Button asChild>
            <Link to="/teacher/register/new">
              <Plus className="h-4 w-4 mr-1" />
              New register
            </Link>
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-center py-12">Loading…</p>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No registers yet. Create your first class register.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {rows.map((r) => (
              <Card key={r.id}>
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-base">
                        {r.classes?.name} · {r.subjects?.name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {new Date(r.register_date).toLocaleDateString("en-GB")} · {r.period_label}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <RegisterStatusBadge status={r.status} />
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/teacher/register/${r.id}`}>Open</Link>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
