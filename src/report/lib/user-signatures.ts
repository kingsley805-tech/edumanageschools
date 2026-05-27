import { supabase } from "@/integrations/supabase/client";

export type SignatureRoleKind = "teacher" | "school_admin";

export type UserSignature = {
  id: string;
  user_id: string;
  school_id: string;
  role_kind: SignatureRoleKind;
  label: string;
  image_url: string;
  is_active: boolean;
  created_at: string;
};

export async function fetchUserSignatures(
  userId: string,
  roleKind: SignatureRoleKind,
): Promise<UserSignature[]> {
  const { data, error } = await supabase
    .from("user_signatures")
    .select("*")
    .eq("user_id", userId)
    .eq("role_kind", roleKind)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as UserSignature[];
}

export async function fetchActiveSignature(
  userId: string,
  roleKind: SignatureRoleKind,
): Promise<UserSignature | null> {
  const { data, error } = await supabase
    .from("user_signatures")
    .select("*")
    .eq("user_id", userId)
    .eq("role_kind", roleKind)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as UserSignature) ?? null;
}

/**
 * Active headmaster signature for a school.
 *
 * Important: avoid querying `user_roles` here because RLS for non-admin users often
 * blocks reads from `user_roles`, which would prevent the signature from showing.
 */
export async function fetchSchoolHeadSignature(schoolId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_signatures")
    .select("image_url")
    .eq("school_id", schoolId)
    .eq("role_kind", "school_admin")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.image_url ?? null;
}

export async function uploadUserSignature(input: {
  userId: string;
  schoolId: string;
  roleKind: SignatureRoleKind;
  label: string;
  file: File;
  setActive?: boolean;
}): Promise<UserSignature> {
  const {
    data: { user: sessionUser },
    error: sessionErr,
  } = await supabase.auth.getUser();
  if (sessionErr || !sessionUser) throw new Error("You must be signed in to upload a signature.");

  const uid = sessionUser.id;
  if (input.userId !== uid) throw new Error("Signature upload must use your own account.");

  if (!input.schoolId?.trim()) {
    throw new Error("Your profile is not linked to a school yet. Contact your school admin.");
  }

  const ext = input.file.name.split(".").pop()?.toLowerCase() || "png";
  // Same bucket layout as school logo/stamp: {schoolId}/signatures/{userId}/file
  const path = `${input.schoolId}/signatures/${uid}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("school-assets")
    .upload(path, input.file, { upsert: false, cacheControl: "3600" });
  let uploadError = upErr;
  let bucket = "school-assets";
  if (uploadError?.message?.includes("Bucket not found")) {
    const fallbackPath = `${input.schoolId}/signatures/${uid}/${crypto.randomUUID()}.${ext}`;
    const fallback = await supabase.storage
      .from("school-logos")
      .upload(fallbackPath, input.file, { upsert: false, cacheControl: "3600" });
    uploadError = fallback.error;
    bucket = "school-logos";
    if (!uploadError) {
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(fallbackPath);
      const imageUrl = pub.publicUrl;
      if (input.setActive !== false) {
        await supabase
          .from("user_signatures")
          .update({ is_active: false })
          .eq("user_id", input.userId)
          .eq("role_kind", input.roleKind);
      }
      const { data, error } = await supabase
        .from("user_signatures")
        .insert({
          user_id: input.userId,
          school_id: input.schoolId,
          role_kind: input.roleKind,
          label: input.label.trim() || "Signature",
          image_url: imageUrl,
          is_active: input.setActive !== false,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as UserSignature;
    }
  }
  if (uploadError) {
    throw new Error(
      uploadError.message.includes("row-level security")
        ? "Storage upload blocked. Ask your admin to run report settings migrations, then try again."
        : uploadError.message,
    );
  }

  const { data: pub } = supabase.storage.from("school-assets").getPublicUrl(path);
  const imageUrl = pub.publicUrl;

  if (input.setActive !== false) {
    const { error: deactivateErr } = await supabase
      .from("user_signatures")
      .update({ is_active: false })
      .eq("user_id", input.userId)
      .eq("role_kind", input.roleKind);
    if (deactivateErr) throw deactivateErr;
  }

  const { data, error } = await supabase
    .from("user_signatures")
    .insert({
      user_id: input.userId,
      school_id: input.schoolId,
      role_kind: input.roleKind,
      label: input.label.trim() || "Signature",
      image_url: imageUrl,
      is_active: input.setActive !== false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as UserSignature;
}

export async function setActiveUserSignature(signatureId: string, userId: string): Promise<void> {
  const { data: row, error: fetchErr } = await supabase
    .from("user_signatures")
    .select("role_kind")
    .eq("id", signatureId)
    .eq("user_id", userId)
    .single();
  if (fetchErr || !row) throw fetchErr ?? new Error("Signature not found");

  await supabase
    .from("user_signatures")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("role_kind", row.role_kind);

  const { error } = await supabase
    .from("user_signatures")
    .update({ is_active: true })
    .eq("id", signatureId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteUserSignature(signatureId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("user_signatures")
    .delete()
    .eq("id", signatureId)
    .eq("user_id", userId);
  if (error) throw error;
}
