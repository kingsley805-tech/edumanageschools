import { supabase } from "@/integrations/supabase/client";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";
import type { ParentWhatsAppContact } from "@/lib/whatsapp/types";

type ParentRow = {
  id: string;
  user_id?: string | null;
  phone?: string | null;
  emergency_contact?: string | null;
  whatsapp_number?: string | null;
  profiles?: { full_name?: string | null; phone?: string | null } | null;
};

function toContact(
  p: ParentRow,
  defaultCountry: string,
  relationship?: string | null,
): ParentWhatsAppContact {
  const whatsapp = p.whatsapp_number?.trim() || null;
  const phone = p.phone?.trim() || null;
  const profilePhone = p.profiles?.phone?.trim() || null;
  const emergency = p.emergency_contact?.trim() || null;

  let source: ParentWhatsAppContact["source"] = "none";
  let phoneRaw: string | null = null;
  if (whatsapp) {
    source = "whatsapp_number";
    phoneRaw = whatsapp;
  } else if (phone) {
    source = "phone";
    phoneRaw = phone;
  } else if (profilePhone) {
    source = "profile_phone";
    phoneRaw = profilePhone;
  } else if (emergency) {
    source = "emergency_contact";
    phoneRaw = emergency;
  }

  return {
    parentId: p.id,
    userId: p.user_id ?? null,
    fullName: p.profiles?.full_name?.trim() || null,
    phoneRaw,
    phoneNormalized: normalizeWhatsAppPhone(phoneRaw, defaultCountry),
    relationship: relationship ?? null,
    source,
  };
}

/** Resolve all linked parent/guardian WhatsApp contacts for a student. */
export async function resolveStudentParentWhatsAppContacts(
  studentId: string,
  defaultCountry = "233",
): Promise<ParentWhatsAppContact[]> {
  const seen = new Set<string>();
  const contacts: ParentWhatsAppContact[] = [];

  const add = (p: ParentRow | null | undefined, relationship?: string | null) => {
    if (!p?.id || seen.has(p.id)) return;
    seen.add(p.id);
    contacts.push(toContact(p, defaultCountry, relationship));
  };

  const { data: student } = await supabase
    .from("students")
    .select("guardian_id")
    .eq("id", studentId)
    .maybeSingle();

  const guardianId = (student as { guardian_id?: string | null } | null)?.guardian_id;
  if (guardianId) {
    const { data: guardian } = await supabase
      .from("parents")
      .select("id, user_id, phone, emergency_contact, whatsapp_number, profiles:user_id(full_name, phone)")
      .eq("id", guardianId)
      .maybeSingle();
    add(guardian as ParentRow | null, "guardian");
  }

  const { data: links } = await supabase
    .from("parent_student_links")
    .select(
      "relationship, parents(id, user_id, phone, emergency_contact, whatsapp_number, profiles:user_id(full_name, phone))",
    )
    .eq("student_id", studentId);

  for (const link of links ?? []) {
    const row = link as {
      relationship?: string | null;
      parents?: ParentRow | null;
    };
    add(row.parents ?? null, row.relationship ?? null);
  }

  return contacts;
}

/** Contacts that have a valid normalized WhatsApp number. */
export function validWhatsAppContacts(contacts: ParentWhatsAppContact[]): ParentWhatsAppContact[] {
  return contacts.filter((c) => Boolean(c.phoneNormalized));
}

export function describeMissingWhatsApp(contacts: ParentWhatsAppContact[]): string {
  if (contacts.length === 0) {
    return "No linked parent/guardian found for this student. Link a parent contact first.";
  }
  const names = contacts.map((c) => c.fullName || "Parent").join(", ");
  return `Linked parent(s) (${names}) have no valid WhatsApp/phone number. Update Parent Contacts.`;
}
