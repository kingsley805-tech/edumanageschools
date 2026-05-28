import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgLetterhead = {
  schoolName: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
};

import { supabase } from "@/integrations/supabase/client";

export async function fetchSchoolLetterhead(schoolId: string): Promise<OrgLetterhead | null> {
  return fetchOrgLetterhead(supabase, schoolId);
}

export async function fetchOrgLetterhead(
  supabase: SupabaseClient,
  schoolId: string,
): Promise<OrgLetterhead | null> {
  const { data, error } = await supabase
    .from("schools")
    .select("school_name, name, logo_url, address, phone, email")
    .eq("id", schoolId)
    .maybeSingle();
  if (error || !data) return null;
  const name = String(data.name ?? data.school_name ?? "").trim() || "School";
  return {
    schoolName: name,
    logoUrl: data.logo_url ?? null,
    address: data.address ?? null,
    phone: data.phone ?? null,
    email: data.email ?? null,
    website: null,
  };
}
