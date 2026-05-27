import { Link, useSearchParams } from "react-router-dom";

import { useQuery, useMutation } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/report/hooks/use-auth";

import { PageHeader } from "@/report/portal/page-header";

import { ActiveTermBanner } from "@/report/portal/active-term-banner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useMemo, useState } from "react";

import { format } from "date-fns";

import { StatCard } from "@/report/portal/stat-card";

import { isPendingAdminAction, statusBadgeVariant, statusLabel } from "@/report/lib/report-card-status";

import { totalFromSubjects, fmtScore, formatRankLabel, type SubjectRow } from "@/report/lib/shepherd-grading";

import { FileText, Clock, CheckCircle, XCircle, Archive, Send, Loader2 } from "lucide-react";

import { useClientPagination } from "@/report/hooks/use-client-pagination";

import { TablePagination } from "@/report/portal/table-pagination";

import { fetchSchoolTerms, formatTermLabel } from "@/report/lib/terms";

import { deliverClassReportsToParents } from "@/report/lib/report-delivery";
import { TERM_REPORT_ADMIN_LIST_SELECT } from "@/report/lib/term-report";

import { useCurrentTerm } from "@/report/hooks/use-school-data";

import { toast } from "sonner";



function AdminReportReview() {

  const { profile, user } = useAuth();

  const schoolId = profile?.school_id ?? "";

  const { data: currentTerm } = useCurrentTerm();

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");

  const [teacherFilter, setTeacherFilter] = useState("all");

  const [classFilter, setClassFilter] = useState("all");

  const [yearFilter, setYearFilter] = useState("all");

  const [termFilter, setTermFilter] = useState("all");

  const [bulkClassId, setBulkClassId] = useState("");

  const [bulkTermId, setBulkTermId] = useState("");



  const { data: terms } = useQuery({

    queryKey: ["school-terms", schoolId],

    enabled: !!schoolId,

    queryFn: () => fetchSchoolTerms(schoolId),

  });



  const { data: classRows } = useQuery({

    queryKey: ["admin-classes-bulk", schoolId],

    enabled: !!schoolId,

    queryFn: async () => {

      const { data, error } = await supabase

        .from("classes")

        .select("id, name")

        .eq("school_id", schoolId)

        .order("name");

      if (error) throw error;

      return data ?? [];

    },

  });



  const { data: reports, refetch } = useQuery({

    queryKey: ["admin-term-reports", profile?.school_id],

    enabled: !!profile?.school_id,

    queryFn: async () => {

      const { data, error } = await supabase

        .from("term_report_cards")

        .select(`${TERM_REPORT_ADMIN_LIST_SELECT}, students(admission_number)`)

        .eq("school_id", profile!.school_id!)

        .neq("status", "draft")

        .order("academic_year", { ascending: false })

        .order("term_label", { ascending: false })

        .order("updated_at", { ascending: false });

      if (error) throw error;

      const rows = data ?? [];

      const teacherIds = [...new Set(rows.map((r) => r.teacher_id).filter(Boolean) as string[])];

      const nameMap = new Map<string, string>();

      if (teacherIds.length) {

        const { data: profs } = await supabase

          .from("profiles")

          .select("id, full_name")

          .in("id", teacherIds);

        for (const p of profs ?? []) nameMap.set(p.id, p.full_name);

      }

      return rows.map((r) => {

        const subs = (Array.isArray(r.subjects) ? r.subjects : []) as unknown as SubjectRow[];

        const computed = totalFromSubjects(subs);

        return {

          ...r,

          admission_number:

            (r.students as { admission_number: string | null } | null)?.admission_number ?? null,

          teacher_name: r.teacher_id ? nameMap.get(r.teacher_id) ?? null : null,

          displayTotal: computed > 0 ? computed : (r.total_score ?? 0),

        };

      });

    },

  });



  const bulkSend = useMutation({

    mutationFn: async () => {

      if (!bulkClassId) throw new Error("Select a class");

      return deliverClassReportsToParents({

        schoolId,

        classId: bulkClassId,

        termId: bulkTermId || currentTerm?.id || null,

        senderId: user!.id,

        senderRole: "admin",

      });

    },

    onSuccess: (r) => {

      toast.success(`Sent ${r.sent} report${r.sent === 1 ? "" : "s"} to parents (${r.skipped} skipped).`);

      refetch();

    },

    onError: (e: Error) => toast.error(e.message),

  });



  const teachers = useMemo(() => {

    const set = new Map<string, string>();

    for (const r of reports ?? []) {

      if (r.teacher_id && r.teacher_name) set.set(r.teacher_id, r.teacher_name);

    }

    return [...set.entries()];

  }, [reports]);



  const classes = useMemo(() => {

    const set = new Set<string>();

    for (const r of reports ?? []) if (r.class_name) set.add(r.class_name);

    return [...set].sort();

  }, [reports]);



  const years = useMemo(() => {

    const set = new Set<string>();

    for (const r of reports ?? []) if (r.academic_year) set.add(r.academic_year);

    return [...set].sort().reverse();

  }, [reports]);



  const filtered = reports?.filter((r) => {

    const q = search.toLowerCase();

    const matchSearch =

      !q ||

      r.student_name.toLowerCase().includes(q) ||

      (r.class_name ?? "").toLowerCase().includes(q) ||

      (r.admission_number ?? "").toLowerCase().includes(q) ||

      (r.term_label ?? "").toLowerCase().includes(q);

    const matchStatus = statusFilter === "all" || r.status === statusFilter;

    const matchTeacher = teacherFilter === "all" || r.teacher_id === teacherFilter;

    const matchClass = classFilter === "all" || r.class_name === classFilter;

    const matchYear = yearFilter === "all" || r.academic_year === yearFilter;

    const matchTerm =

      termFilter === "all" || r.term_id === termFilter || r.term_label === termFilter;

    return matchSearch && matchStatus && matchTeacher && matchClass && matchYear && matchTerm;

  });



  const pag = useClientPagination(filtered ?? [], {

    resetKey: `${search}-${statusFilter}-${teacherFilter}-${classFilter}-${yearFilter}-${termFilter}`,

  });



  const pending = reports?.filter((r) => isPendingAdminAction(r.status)).length ?? 0;

  const approved = reports?.filter((r) => r.status === "approved" || r.status === "published").length ?? 0;

  const rejected = reports?.filter((r) => r.status === "rejected").length ?? 0;



  return (

    <>

      <PageHeader

        title="Report card review"

        description="Review, edit, approve, deliver to parents, and browse archived reports."

        actions={

          <Button asChild variant="outline" size="sm">

            <Link to="/admin/report-cards/archive">

              <Archive className="mr-1 h-4 w-4" />

              Archive

            </Link>

          </Button>

        }

      />

      <div className="space-y-6 p-6 md:p-8">

        <ActiveTermBanner />

        <div className="grid gap-4 md:grid-cols-4">

          <StatCard label="Pending review" value={pending} icon={Clock} />

          <StatCard label="Approved" value={approved} icon={CheckCircle} />

          <StatCard label="Returned" value={rejected} icon={XCircle} tone="text-muted-foreground" />

          <StatCard label="Total submitted" value={reports?.length ?? 0} icon={FileText} />

        </div>



        <Card>

          <CardHeader>

            <CardTitle className="font-display text-base">Bulk send to parents</CardTitle>

            <CardDescription>

              Deliver all approved reports for a class. Already-sent reports are skipped.

            </CardDescription>

          </CardHeader>

          <CardContent className="flex flex-wrap items-end gap-3">

            <div className="space-y-1">

              <Label>Class</Label>

              <Select value={bulkClassId} onValueChange={setBulkClassId}>

                <SelectTrigger className="w-48">

                  <SelectValue placeholder="Select class" />

                </SelectTrigger>

                <SelectContent>

                  {(classRows ?? []).map((c) => (

                    <SelectItem key={c.id} value={c.id}>

                      {c.name}

                    </SelectItem>

                  ))}

                </SelectContent>

              </Select>

            </div>

            <div className="space-y-1">

              <Label>Term (optional)</Label>

              <Select value={bulkTermId || "__current__"} onValueChange={(v) => setBulkTermId(v === "__current__" ? "" : v)}>

                <SelectTrigger className="w-52">

                  <SelectValue placeholder="Active term" />

                </SelectTrigger>

                <SelectContent>

                  <SelectItem value="__current__">

                    {currentTerm ? formatTermLabel(currentTerm) : "Active term"}

                  </SelectItem>

                  {(terms ?? []).map((t) => (

                    <SelectItem key={t.id} value={t.id}>

                      {formatTermLabel(t)}

                    </SelectItem>

                  ))}

                </SelectContent>

              </Select>

            </div>

            <Button

              disabled={!bulkClassId || bulkSend.isPending}

              onClick={() => bulkSend.mutate()}

            >

              {bulkSend.isPending ? (

                <Loader2 className="mr-1 h-4 w-4 animate-spin" />

              ) : (

                <Send className="mr-1 h-4 w-4" />

              )}

              Send class reports

            </Button>

          </CardContent>

        </Card>



        <div className="flex flex-wrap gap-3">

          <Input

            placeholder="Search student, admission #, class…"

            value={search}

            onChange={(e) => setSearch(e.target.value)}

            className="max-w-xs"

          />

          <Select value={yearFilter} onValueChange={setYearFilter}>

            <SelectTrigger className="w-40">

              <SelectValue placeholder="Year" />

            </SelectTrigger>

            <SelectContent>

              <SelectItem value="all">All years</SelectItem>

              {years.map((y) => (

                <SelectItem key={y} value={y}>

                  {y}

                </SelectItem>

              ))}

            </SelectContent>

          </Select>

          <Select value={termFilter} onValueChange={setTermFilter}>

            <SelectTrigger className="w-44">

              <SelectValue placeholder="Term" />

            </SelectTrigger>

            <SelectContent>

              <SelectItem value="all">All terms</SelectItem>

              {(terms ?? []).map((t) => (

                <SelectItem key={t.id} value={t.id}>

                  {formatTermLabel(t)}

                </SelectItem>

              ))}

            </SelectContent>

          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>

            <SelectTrigger className="w-40">

              <SelectValue placeholder="Status" />

            </SelectTrigger>

            <SelectContent>

              <SelectItem value="all">All statuses</SelectItem>

              <SelectItem value="pending_review">Pending Review</SelectItem>

              <SelectItem value="reviewed">Reviewed</SelectItem>

              <SelectItem value="approved">Approved</SelectItem>

              <SelectItem value="published">Published</SelectItem>

              <SelectItem value="rejected">Rejected</SelectItem>

            </SelectContent>

          </Select>

          <Select value={teacherFilter} onValueChange={setTeacherFilter}>

            <SelectTrigger className="w-44">

              <SelectValue placeholder="Teacher" />

            </SelectTrigger>

            <SelectContent>

              <SelectItem value="all">All teachers</SelectItem>

              {teachers.map(([id, name]) => (

                <SelectItem key={id} value={id}>

                  {name}

                </SelectItem>

              ))}

            </SelectContent>

          </Select>

          <Select value={classFilter} onValueChange={setClassFilter}>

            <SelectTrigger className="w-40">

              <SelectValue placeholder="Class" />

            </SelectTrigger>

            <SelectContent>

              <SelectItem value="all">All classes</SelectItem>

              {classes.map((c) => (

                <SelectItem key={c} value={c}>

                  {c}

                </SelectItem>

              ))}

            </SelectContent>

          </Select>

        </div>



        <Card>

          <CardContent className="p-0">

            <div className="table-scroll">

              <Table>

                <TableHeader>

                  <TableRow>

                    <TableHead>Student</TableHead>

                    <TableHead>Admission #</TableHead>

                    <TableHead>Class</TableHead>

                    <TableHead>Year</TableHead>

                    <TableHead>Term</TableHead>

                    <TableHead>Teacher</TableHead>

                    <TableHead>Total</TableHead>

                    <TableHead>Position</TableHead>

                    <TableHead>Status</TableHead>

                    <TableHead>Submitted</TableHead>

                    <TableHead className="text-right">Open</TableHead>

                  </TableRow>

                </TableHeader>

                <TableBody>

                  {pag.slice.map((r) => (

                    <TableRow key={r.id}>

                      <TableCell className="font-medium">{r.student_name}</TableCell>

                      <TableCell className="text-sm text-muted-foreground">

                        {r.admission_number ?? "—"}

                      </TableCell>

                      <TableCell>{r.class_name}</TableCell>

                      <TableCell className="text-sm">{r.academic_year ?? "—"}</TableCell>

                      <TableCell>{r.term_label || "—"}</TableCell>

                      <TableCell>{r.teacher_name ?? "—"}</TableCell>

                      <TableCell>{fmtScore(r.displayTotal)}</TableCell>

                      <TableCell>{formatRankLabel(r.class_position)}</TableCell>

                      <TableCell>

                        <Badge variant={statusBadgeVariant(r.status)}>{statusLabel(r.status)}</Badge>

                      </TableCell>

                      <TableCell className="text-sm text-muted-foreground">

                        {r.submitted_at

                          ? format(new Date(r.submitted_at), "PP")

                          : r.saved_at

                            ? format(new Date(r.saved_at), "PP")

                            : "—"}

                      </TableCell>

                      <TableCell className="text-right space-x-1">

                        <Button asChild size="sm" variant="outline">

                          <Link to={`/admin/report-cards/view?id=${encodeURIComponent(r.id)}`}>

                            Review

                          </Link>

                        </Button>

                        <Button asChild size="sm" variant="ghost">

                          <Link to={`/admin/report-cards/versions?id=${encodeURIComponent(r.id)}`}>

                            History

                          </Link>

                        </Button>

                      </TableCell>

                    </TableRow>

                  ))}

                  {!pag.total && (

                    <TableRow>

                      <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">

                        No submitted reports yet.

                      </TableCell>

                    </TableRow>

                  )}

                </TableBody>

              </Table>

            </div>

            <TablePagination

              page={pag.page}

              totalPages={pag.totalPages}

              total={pag.total}

              from={pag.from}

              to={pag.to}

              pageSize={pag.pageSize}

              pageSizes={pag.pageSizes}

              onPageChange={pag.setPage}

              onPageSizeChange={pag.setPageSize}

            />

          </CardContent>

        </Card>

      </div>

    </>

  );

}

import { withReportLayout } from "@/report/withReportLayout";
export default withReportLayout("admin", AdminReportReview);
