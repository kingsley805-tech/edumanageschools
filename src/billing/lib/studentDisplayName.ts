// @ts-nocheck
﻿import { supabase } from "@/integrations/supabase/client";

export type StudentNameFields = {
  first_name: string;
  last_name: string;
  student_id: string;
};

export type ProfileNameFields = {
  first_name: string | null;
  last_name: string | null;
} | null;

export function isPlaceholderStudentName(firstName: string, lastName: string): boolean {
  return firstName.trim().toLowerCase() === "pending" && lastName.trim().toLowerCase() === "enrollment";
}

export function formatStudentDisplayName(
  student: StudentNameFields,
  linkedProfile?: ProfileNameFields,
): string {
  if (!isPlaceholderStudentName(student.first_name, student.last_name)) {
    return `${student.first_name} ${student.last_name}`.trim();
  }
  const fromProfile = [linkedProfile?.first_name, linkedProfile?.last_name]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fromProfile) return fromProfile;
  return student.student_id.trim() || "Student";
}

function splitFullName(full: string): { first_name: string; last_name: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "Student", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

type StudentRowDb = {
  id: string;
  admission_no: string | null;
  full_name?: string | null;
  user_id: string | null;
  class_id: string | null;
};

export type StudentWithLinkedProfile = StudentRowDb & {
  first_name: string;
  last_name: string;
  student_id: string;
  is_active: boolean;
  linkedProfile: { first_name: string; last_name: string } | null;
};

export async function fetchStudentsWithLinkedProfiles(schoolId: string): Promise<StudentWithLinkedProfile[]> {
  const { data, error } = await supabase
    .from("students")
    .select("id, admission_no, full_name, user_id, class_id, school_id")
    .eq("school_id", schoolId);
  if (error) throw error;

  const rows = (data ?? []) as StudentRowDb[];
  const userIds = [...new Set(rows.map((s) => s.user_id).filter(Boolean))] as string[];
  const profileByUser = new Map<string, { first_name: string; last_name: string }>();

  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    for (const p of profs ?? []) {
      const split = splitFullName(p.full_name ?? "");
      profileByUser.set(p.id, split);
    }
  }

  return rows.map((s) => {
    const admission = (s.admission_no ?? "").trim() || s.id.slice(0, 8);
    const fromFull = s.full_name ? splitFullName(s.full_name) : null;
    const fromProfile = s.user_id ? profileByUser.get(s.user_id) : null;
    const first_name = fromFull?.first_name ?? fromProfile?.first_name ?? "Student";
    const last_name = fromFull?.last_name ?? fromProfile?.last_name ?? "";
    return {
      ...s,
      first_name,
      last_name,
      student_id: admission,
      is_active: true,
      linkedProfile: fromProfile,
    };
  });
}

export async function mapStudentIdsToDisplayNames(
  schoolId: string,
  studentIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (studentIds.length === 0) return map;
  const students = await fetchStudentsWithLinkedProfiles(schoolId);
  for (const s of students) {
    if (studentIds.includes(s.id)) {
      map.set(s.id, formatStudentDisplayName(s, s.linkedProfile));
    }
  }
  return map;
}