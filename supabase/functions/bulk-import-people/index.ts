import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Entity = "student" | "teacher" | "parent";

type RowResult = {
  rowNumber: number;
  action: "created" | "updated" | "skipped" | "failed";
  message?: string;
  entityId?: string;
};

function normalizeAdmission(admissionNumber: string): string {
  return String(admissionNumber ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function buildStudentAuthEmail(admissionNumber: string, schoolId: string): string {
  const slug = normalizeAdmission(admissionNumber)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  return `${schoolId}.${slug}@students.app`;
}

async function assertAuthorized(
  admin: SupabaseClient,
  userId: string,
  entity: Entity,
): Promise<{ ok: boolean; schoolId: string | null; error?: string }> {
  const { data: profile } = await admin
    .from("profiles")
    .select("school_id")
    .eq("id", userId)
    .maybeSingle();

  const schoolId = profile?.school_id ?? null;

  const { data: adminRole } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "super_admin"])
    .limit(1);

  if (adminRole && adminRole.length > 0) {
    return { ok: true, schoolId };
  }

  const perm =
    entity === "student"
      ? "students.import"
      : entity === "teacher"
        ? "teachers.manage"
        : "parents.manage";

  const { data: hasPerm, error } = await admin.rpc("has_permission", {
    _user_id: userId,
    _permission: perm,
    _school_id: schoolId,
  });

  if (error) {
    // Fallback: also accept students.create for student import
    if (entity === "student") {
      const { data: createPerm } = await admin.rpc("has_permission", {
        _user_id: userId,
        _permission: "students.create",
        _school_id: schoolId,
      });
      if (createPerm) return { ok: true, schoolId };
    }
    return { ok: false, schoolId, error: error.message };
  }

  if (!hasPerm) {
    return { ok: false, schoolId, error: `Missing permission: ${perm}` };
  }
  return { ok: true, schoolId };
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function findOrCreateParent(
  admin: SupabaseClient,
  schoolId: string,
  schoolCode: string,
  opts: {
    full_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    password?: string;
  },
): Promise<string | null> {
  const email = (opts.email ?? "").trim().toLowerCase();
  const phone = (opts.phone ?? "").trim();
  if (!email && !phone && !opts.full_name) return null;

  if (email) {
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, parents!parents_user_id_fkey(id, school_id)")
      .eq("email", email)
      .maybeSingle();

    const parents = (existingProfile as any)?.parents;
    const parentRow = Array.isArray(parents) ? parents[0] : parents;
    if (parentRow?.id && (!parentRow.school_id || parentRow.school_id === schoolId)) {
      await admin
        .from("parents")
        .update({
          phone: phone || undefined,
          address: opts.address || undefined,
        })
        .eq("id", parentRow.id);
      return parentRow.id as string;
    }
  }

  if (phone) {
    const digits = phone.replace(/\D/g, "");
    const { data: byPhone } = await admin
      .from("parents")
      .select("id, phone, user_id")
      .eq("school_id", schoolId);
    const match = (byPhone ?? []).find(
      (p) => (p.phone ?? "").replace(/\D/g, "") === digits,
    );
    if (match?.id) {
      await admin
        .from("parents")
        .update({ address: opts.address || undefined })
        .eq("id", match.id);
      return match.id;
    }
  }

  if (!email) {
    // Cannot create auth user without email — synthesize from phone
    if (!phone) return null;
  }

  const authEmail =
    email ||
    `parent.${schoolId}.${phone.replace(/\D/g, "")}@parents.app`;
  const password = opts.password || "ChangeMe123!";

  const { data: authData, error: createError } = await admin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: opts.full_name || "Parent",
      role: "parent",
      school_code: schoolCode,
      school_id: schoolId,
      phone,
    },
  });

  if (createError || !authData.user) {
    // Maybe user already exists
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    void list;
    const { data: profileByEmail } = await admin
      .from("profiles")
      .select("id")
      .eq("email", authEmail)
      .maybeSingle();
    if (profileByEmail?.id) {
      const { data: parent } = await admin
        .from("parents")
        .select("id")
        .eq("user_id", profileByEmail.id)
        .maybeSingle();
      if (parent?.id) return parent.id;
    }
    console.error("create parent failed", createError);
    return null;
  }

  await sleep(1500);

  const { data: parent } = await admin
    .from("parents")
    .select("id")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (parent?.id) {
    await admin
      .from("parents")
      .update({
        phone: phone || null,
        address: opts.address || null,
        school_id: schoolId,
      })
      .eq("id", parent.id);
    return parent.id;
  }
  return null;
}

async function linkParentStudent(
  admin: SupabaseClient,
  parentId: string,
  studentId: string,
  relationship: string,
) {
  const { data: existing } = await admin
    .from("parent_student_links")
    .select("id")
    .eq("parent_id", parentId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (existing) {
    await admin
      .from("parent_student_links")
      .update({ relationship })
      .eq("id", existing.id);
    return;
  }
  await admin.from("parent_student_links").insert({
    parent_id: parentId,
    student_id: studentId,
    relationship,
  });
}

async function ensureClassId(
  admin: SupabaseClient,
  schoolId: string,
  classId: string | null | undefined,
  className: string | null | undefined,
  section: string | null | undefined,
): Promise<string | null> {
  if (classId) return classId;
  const raw = String(className ?? "").trim();
  if (!raw) return null;

  const sectionTrim = String(section ?? "").trim();
  let name = raw;
  let stream: string | null = sectionTrim || null;
  const compact = raw.match(/^(\d+)\s*([A-Za-z])$/);
  if (!stream && compact) {
    name = compact[1];
    stream = compact[2].toUpperCase();
  }

  const { data: existing } = await admin
    .from("classes")
    .select("id, name, stream")
    .eq("school_id", schoolId);

  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const hit = (existing ?? []).find((c) => {
    const cn = norm(c.name);
    const cs = c.stream ? norm(c.stream) : "";
    if (cn === norm(raw)) return true;
    if (cn === norm(name) && (!stream || cs === norm(stream))) return true;
    if (`${cn}${cs}` === norm(raw).replace(/\s+/g, "")) return true;
    return false;
  });
  if (hit) return hit.id;

  const { data: created, error } = await admin
    .from("classes")
    .insert({
      name,
      stream,
      level: name,
      school_id: schoolId,
    })
    .select("id")
    .single();
  if (!error && created?.id) return created.id;

  const { data: created2 } = await admin
    .from("classes")
    .insert({
      name: raw,
      stream: null,
      level: raw,
      school_id: schoolId,
    })
    .select("id")
    .single();
  return created2?.id ?? null;
}

async function importStudent(
  admin: SupabaseClient,
  schoolId: string,
  schoolCode: string,
  row: Record<string, unknown>,
): Promise<RowResult> {
  const rowNumber = Number(row.rowNumber) || 0;
  try {
    const admission_no = String(row.admission_no ?? "").trim();
    const full_name = String(row.full_name ?? "").trim();
    if (!admission_no || !full_name) {
      return { rowNumber, action: "failed", message: "Missing admission number or name" };
    }

    const existingId = (row.existing_student_id as string | null) || null;
    let studentId = existingId;

    if (!studentId) {
      const { data: found } = await admin
        .from("students")
        .select("id, user_id")
        .eq("school_id", schoolId)
        .or(`admission_no.eq.${admission_no},admission_number.eq.${admission_no}`)
        .maybeSingle();
      if (found?.id) studentId = found.id;
    }

    let guardianId: string | null = null;
    if (row.parent_email || row.parent_phone || row.parent_name) {
      guardianId = await findOrCreateParent(admin, schoolId, schoolCode, {
        full_name: String(row.parent_name ?? ""),
        email: String(row.parent_email ?? ""),
        phone: String(row.parent_phone ?? ""),
        address: String(row.address ?? ""),
        password: String(row.password ?? "ChangeMe123!"),
      });
    }

    const resolvedClassId = await ensureClassId(
      admin,
      schoolId,
      (row.class_id as string) || null,
      String(row.class_name ?? ""),
      String(row.section ?? ""),
    );

    const patch = {
      admission_no,
      admission_number: admission_no,
      full_name,
      gender: (row.gender as string) || null,
      date_of_birth: (row.date_of_birth as string) || null,
      class_id: resolvedClassId,
      guardian_id: guardianId,
      school_id: schoolId,
    };

    if (studentId) {
      const { error } = await admin.from("students").update(patch).eq("id", studentId);
      if (error) throw error;
      await admin
        .from("profiles")
        .update({ full_name })
        .eq("id", (
          await admin.from("students").select("user_id").eq("id", studentId).single()
        ).data?.user_id ?? "");
      if (guardianId) {
        await linkParentStudent(admin, guardianId, studentId, "Guardian");
        await admin.from("students").update({ guardian_id: guardianId }).eq("id", studentId);
      }
      return { rowNumber, action: "updated", entityId: studentId };
    }

    const authEmail = buildStudentAuthEmail(admission_no, schoolId);
    const password = String(row.password ?? "ChangeMe123!");

    const { data: authData, error: createError } = await admin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role: "student",
        school_code: schoolCode,
        school_id: schoolId,
        registration_number: admission_no,
        gender: row.gender,
      },
    });
    if (createError || !authData.user) throw createError ?? new Error("Failed to create student user");

    await sleep(1500);

    const { data: student, error: updErr } = await admin
      .from("students")
      .update(patch)
      .eq("user_id", authData.user.id)
      .select("id")
      .maybeSingle();
    if (updErr) throw updErr;

    const newId = student?.id;
    if (newId && guardianId) {
      await linkParentStudent(admin, guardianId, newId, "Guardian");
    }

    return { rowNumber, action: "created", entityId: newId };
  } catch (e) {
    return {
      rowNumber,
      action: "failed",
      message: e instanceof Error ? e.message : "Student import failed",
    };
  }
}

async function importTeacher(
  admin: SupabaseClient,
  schoolId: string,
  schoolCode: string,
  row: Record<string, unknown>,
): Promise<RowResult> {
  const rowNumber = Number(row.rowNumber) || 0;
  try {
    const employee_no = String(row.employee_no ?? "").trim();
    const full_name = String(row.full_name ?? "").trim();
    const email = String(row.email ?? "").trim().toLowerCase();
    if (!employee_no || !full_name || !email) {
      return { rowNumber, action: "failed", message: "Missing teacher ID, name, or email" };
    }

    let teacherId = (row.existing_teacher_id as string | null) || null;
    let wasExisting = Boolean(teacherId);
    if (!teacherId) {
      const { data: byEmp } = await admin
        .from("teachers")
        .select("id, user_id")
        .eq("school_id", schoolId)
        .eq("employee_no", employee_no)
        .maybeSingle();
      if (byEmp?.id) {
        teacherId = byEmp.id;
        wasExisting = true;
      }
    }

    const phone = String(row.phone ?? "").trim();
    const subject_specialty = (row.subject_specialty as string) || null;
    let classIds = [...((row.class_ids as string[]) || [])];
    let subjectIds = [...((row.subject_ids as string[]) || [])];

    const classNames = (row.class_names as string[]) || [];
    for (const cn of classNames) {
      const id = await ensureClassId(admin, schoolId, null, cn, null);
      if (id && !classIds.includes(id)) classIds.push(id);
    }

    const subjectNames = (row.subject_names as string[]) || [];
    for (const sn of subjectNames) {
      const name = String(sn ?? "").trim();
      if (!name) continue;
      const { data: existingSub } = await admin
        .from("subjects")
        .select("id")
        .eq("school_id", schoolId)
        .ilike("name", name)
        .maybeSingle();
      if (existingSub?.id) {
        if (!subjectIds.includes(existingSub.id)) subjectIds.push(existingSub.id);
        continue;
      }
      const { data: createdSub } = await admin
        .from("subjects")
        .insert({ name, school_id: schoolId })
        .select("id")
        .single();
      if (createdSub?.id && !subjectIds.includes(createdSub.id)) subjectIds.push(createdSub.id);
    }

    if (teacherId) {
      await admin
        .from("teachers")
        .update({
          employee_no,
          subject_specialty,
          school_id: schoolId,
        })
        .eq("id", teacherId);

      const { data: t } = await admin
        .from("teachers")
        .select("user_id")
        .eq("id", teacherId)
        .single();
      if (t?.user_id) {
        await admin
          .from("profiles")
          .update({ full_name, phone: phone || null })
          .eq("id", t.user_id);
      }
    } else {
      const password = String(row.password ?? "ChangeMe123!");
      const { data: authData, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
          role: "teacher",
          school_code: schoolCode,
          school_id: schoolId,
          phone,
        },
      });
      if (createError || !authData.user) throw createError ?? new Error("Failed to create teacher");

      await sleep(1500);

      const { data: teacher, error: updErr } = await admin
        .from("teachers")
        .update({
          employee_no,
          subject_specialty,
          school_id: schoolId,
        })
        .eq("user_id", authData.user.id)
        .select("id")
        .maybeSingle();
      if (updErr) throw updErr;
      teacherId = teacher?.id ?? null;
      await admin
        .from("profiles")
        .update({ full_name, phone: phone || null })
        .eq("id", authData.user.id);
    }

    if (teacherId && classIds.length && subjectIds.length) {
      for (const classId of classIds) {
        for (const subjectId of subjectIds) {
          const { data: existing } = await admin
            .from("class_subjects")
            .select("id")
            .eq("teacher_id", teacherId)
            .eq("class_id", classId)
            .eq("subject_id", subjectId)
            .maybeSingle();
          if (!existing) {
            await admin.from("class_subjects").insert({
              teacher_id: teacherId,
              class_id: classId,
              subject_id: subjectId,
            });
          }
        }
      }
    } else if (teacherId && classIds.length && !subjectIds.length) {
      // Assign teacher as class teacher where empty
      for (const classId of classIds) {
        await admin
          .from("classes")
          .update({ class_teacher_id: teacherId })
          .eq("id", classId)
          .is("class_teacher_id", null);
      }
    }

    if (!teacherId) {
      return { rowNumber, action: "failed", message: "Teacher row missing after create" };
    }
    return {
      rowNumber,
      action: wasExisting ? "updated" : "created",
      entityId: teacherId,
    };
  } catch (e) {
    return {
      rowNumber,
      action: "failed",
      message: e instanceof Error ? e.message : "Teacher import failed",
    };
  }
}

async function importParent(
  admin: SupabaseClient,
  schoolId: string,
  schoolCode: string,
  row: Record<string, unknown>,
): Promise<RowResult> {
  const rowNumber = Number(row.rowNumber) || 0;
  try {
    const full_name = String(row.full_name ?? "").trim();
    const email = String(row.email ?? "").trim().toLowerCase();
    const phone = String(row.phone ?? "").trim();
    const address = String(row.address ?? "").trim();
    const relationship = String(row.relationship ?? "Parent").trim() || "Parent";
    const studentIds = (row.student_ids as string[]) || [];
    const password = String(row.password ?? "ChangeMe123!");

    if (!full_name) {
      return { rowNumber, action: "failed", message: "Full name is required" };
    }

    let parentId = (row.existing_parent_id as string | null) || null;
    let created = false;

    if (parentId) {
      await admin
        .from("parents")
        .update({
          phone: phone || null,
          address: address || null,
          school_id: schoolId,
        })
        .eq("id", parentId);
      const { data: p } = await admin
        .from("parents")
        .select("user_id")
        .eq("id", parentId)
        .single();
      if (p?.user_id) {
        await admin.from("profiles").update({ full_name, phone: phone || null }).eq("id", p.user_id);
      }
    } else {
      parentId = await findOrCreateParent(admin, schoolId, schoolCode, {
        full_name,
        email,
        phone,
        address,
        password,
      });
      created = true;
      if (!parentId) {
        return { rowNumber, action: "failed", message: "Could not create parent account" };
      }
      // If findOrCreate matched existing, treat as update
      if (row.existing_parent_id) created = false;
    }

    for (const studentId of studentIds) {
      await linkParentStudent(admin, parentId!, studentId, relationship);
      await admin
        .from("students")
        .update({ guardian_id: parentId })
        .eq("id", studentId)
        .is("guardian_id", null);
    }

    // Store occupation in emergency_contact field suffix only if empty — avoid inventing columns
    if (row.occupation && typeof row.occupation === "string" && row.occupation.trim()) {
      const { data: cur } = await admin
        .from("parents")
        .select("emergency_contact")
        .eq("id", parentId!)
        .maybeSingle();
      if (!cur?.emergency_contact) {
        await admin
          .from("parents")
          .update({ emergency_contact: `Occupation: ${String(row.occupation).trim()}` })
          .eq("id", parentId!);
      }
    }

    return {
      rowNumber,
      action: created && !row.existing_parent_id ? "created" : "updated",
      entityId: parentId ?? undefined,
    };
  } catch (e) {
    return {
      rowNumber,
      action: "failed",
      message: e instanceof Error ? e.message : "Parent import failed",
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: callerData, error: callerError } = await admin.auth.getUser(token);
    if (callerError || !callerData.user) {
      return new Response(JSON.stringify({ error: "Invalid authentication token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const entity = body.entity as Entity;
    const rows = (body.rows ?? []) as Record<string, unknown>[];
    const requestedSchoolId = body.school_id as string | undefined;

    if (!["student", "teacher", "parent"].includes(entity)) {
      return new Response(JSON.stringify({ error: "Invalid entity" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authz = await assertAuthorized(admin, callerData.user.id, entity);
    if (!authz.ok) {
      return new Response(JSON.stringify({ error: authz.error || "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const schoolId = requestedSchoolId || authz.schoolId;
    if (!schoolId) {
      return new Response(JSON.stringify({ error: "School not found for caller" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (authz.schoolId && requestedSchoolId && authz.schoolId !== requestedSchoolId) {
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", callerData.user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (!roles) {
        return new Response(JSON.stringify({ error: "Cannot import into another school" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: school } = await admin
      .from("schools")
      .select("school_code")
      .eq("id", schoolId)
      .maybeSingle();
    const schoolCode = school?.school_code ?? "";

    const results: RowResult[] = [];
    for (const row of rows) {
      if (entity === "student") {
        results.push(await importStudent(admin, schoolId, schoolCode, row));
      } else if (entity === "teacher") {
        results.push(await importTeacher(admin, schoolId, schoolCode, row));
      } else {
        results.push(await importParent(admin, schoolId, schoolCode, row));
      }
    }

    const summary = {
      total: results.length,
      created: results.filter((r) => r.action === "created").length,
      updated: results.filter((r) => r.action === "updated").length,
      skipped: results.filter((r) => r.action === "skipped").length,
      failed: results.filter((r) => r.action === "failed").length,
    };

    return new Response(JSON.stringify({ success: true, results, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
