import { supabase } from "@/integrations/supabase/client";
import type { ReportCardData } from "@/components/report-card";
import { calculateGPA, studentAverage, rankStudents } from "./analytics";

export async function fetchReportCard(studentId: string, termId?: string): Promise<ReportCardData | null> {
  const { data: student } = await supabase
    .from("students")
    .select("*, classes(name), schools(*)")
    .eq("id", studentId)
    .single();
  if (!student) return null;

  let termQuery = supabase.from("terms").select("*").eq("school_id", student.school_id);
  if (termId) termQuery = termQuery.eq("id", termId);
  else termQuery = termQuery.eq("is_current", true);
  const { data: term } = await termQuery.maybeSingle();
  if (!term) return null;

  const { data: results } = await supabase
    .from("results")
    .select("*, subjects(name)")
    .eq("student_id", studentId)
    .eq("term_id", term.id);

  const { data: classStudents } = student.class_id
    ? await supabase.from("students").select("id, full_name").eq("class_id", student.class_id)
    : { data: [{ id: student.id, full_name: student.full_name }] };

  const classIds = (classStudents ?? []).map((s) => s.id);
  const { data: classResults } = classIds.length
    ? await supabase.from("results").select("student_id, total").in("student_id", classIds).eq("term_id", term.id)
    : { data: [] };

  const allMapped = (classResults ?? []).map((r) => ({
    student_id: r.student_id,
    subject_id: "",
    ca_score: 0,
    exam_score: 0,
    total: Number(r.total),
    grade: null,
  }));

  const mapped = (results ?? []).map((r) => ({
    student_id: studentId,
    subject_id: r.subject_id,
    subject_name: (r.subjects as { name: string })?.name ?? "",
    ca_score: Number(r.ca_score),
    exam_score: Number(r.exam_score),
    total: Number(r.total),
    grade: r.grade ?? "F",
    remark: r.remark,
    position: r.position,
  }));

  const rankings = rankStudents(
    (classStudents ?? []).map((s) => ({ id: s.id, name: s.full_name })),
    allMapped,
  );
  const myRank = rankings.find((r) => r.id === studentId);

  const { data: attendance } = await supabase
    .from("attendance")
    .select("status")
    .eq("student_id", studentId)
    .eq("term_id", term.id);

  const present = attendance?.filter((a) => a.status === "present").length ?? 0;
  const total = attendance?.length ?? 0;

  const school = student.schools as (ReportCardData["school"] & { next_term_date?: string | null });
  const avg = studentAverage(mapped);
  const gpa = calculateGPA(mapped.map((m) => m.total));

  return {
    school: {
      name: school?.name ?? "School",
      motto: school?.motto,
      address: school?.address,
      logo_url: school?.logo_url,
      primary_color: school?.primary_color,
      principal_name: school?.principal_name,
    },
    student: {
      full_name: student.full_name,
      admission_number: student.admission_number,
      class_name: (student.classes as { name: string } | null)?.name,
      photo_url: student.photo_url,
      gender: student.gender,
    },
    term: { session: term.session, name: term.name },
    results: mapped.map((m) => ({
      subject_name: m.subject_name,
      ca_score: m.ca_score,
      exam_score: m.exam_score,
      total: m.total,
      grade: m.grade,
      remark: m.remark,
    })),
    summary: {
      average: avg,
      gpa,
      position: myRank?.position ?? 1,
      class_size: classStudents?.length ?? 1,
      attendance_present: present,
      attendance_total: total || 1,
      promotion_status: avg >= 40 ? "Promoted" : "Repeat",
      class_teacher_remark: avg >= 70 ? "Excellent performance. Keep it up!" : avg >= 50 ? "Good effort. Room for improvement." : "Needs focused support.",
      principal_remark: "We encourage continued dedication to academic excellence.",
    },
    next_term_date: school?.next_term_date ?? null,
    verifyCode: `${studentId.slice(0, 8)}-${term.id.slice(0, 8)}`,
  };
}
