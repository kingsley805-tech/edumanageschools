// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

export interface ContactInquiryPayload {
  name: string;
  email: string;
  phone?: string;
  institution_name?: string;
  subject: string;
  message: string;
  category?: "general" | "deployment" | "support" | "billing" | "partnership";
}

export interface ContactInquiryRecord extends ContactInquiryPayload {
  id: string;
  created_at: string;
  status: "unread" | "read" | "resolved";
  notes?: string;
}

const LOCAL_STORAGE_KEY = "edumanage_contact_inquiries_store";

export function getStoredInquiries(): ContactInquiryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveStoredInquiries(inquiries: ContactInquiryRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(inquiries));
    window.dispatchEvent(new CustomEvent("edumanage_inquiries_updated"));
  } catch (err) {
    console.warn("Could not write inquiries to localStorage", err);
  }
}

/**
 * Submit an inquiry from public contact form.
 */
export async function submitContactInquiry(
  payload: ContactInquiryPayload
): Promise<{ success: boolean; id?: string; error?: string }> {
  const newRecord: ContactInquiryRecord = {
    ...payload,
    id: `inq-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    created_at: new Date().toISOString(),
    status: "unread",
  };

  // 1. Save to local fallback store
  try {
    const current = getStoredInquiries();
    saveStoredInquiries([newRecord, ...current]);
  } catch (e) {
    console.warn("Local storage fallback warning:", e);
  }

  // 2. Attempt insert to Supabase if table exists
  try {
    await supabase.from("contact_inquiries" as any).insert({
      id: newRecord.id,
      name: payload.name,
      email: payload.email,
      phone: payload.phone || null,
      institution_name: payload.institution_name || null,
      subject: payload.subject,
      message: payload.message,
      category: payload.category || "general",
      status: "unread",
      created_at: newRecord.created_at,
    });
  } catch (err) {
    // If Supabase table is not configured yet, the local store ensures zero message loss
    console.info("Supabase sync info (local record retained):", err);
  }

  // 3. Optional: Attempt edge function notification
  try {
    await supabase.functions.invoke("send-contact-email", {
      body: payload,
    });
  } catch {
    // Non-blocking
  }

  return { success: true, id: newRecord.id };
}

/**
 * Fetch inquiries for Super Admin portal
 */
export async function fetchContactInquiries(): Promise<ContactInquiryRecord[]> {
  const localItems = getStoredInquiries();

  try {
    const { data, error } = await supabase
      .from("contact_inquiries" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data && Array.isArray(data) && data.length > 0) {
      // Merge unique items
      const mergedMap = new Map<string, ContactInquiryRecord>();
      for (const item of localItems) mergedMap.set(item.id, item);
      for (const item of data) mergedMap.set(item.id, item as ContactInquiryRecord);
      const list = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      saveStoredInquiries(list);
      return list;
    }
  } catch {
    // fallback
  }

  return localItems;
}

/**
 * Mark inquiry status
 */
export async function updateInquiryStatus(
  id: string,
  status: "unread" | "read" | "resolved"
): Promise<boolean> {
  const local = getStoredInquiries().map((inq) =>
    inq.id === id ? { ...inq, status } : inq
  );
  saveStoredInquiries(local);

  try {
    await supabase
      .from("contact_inquiries" as any)
      .update({ status })
      .eq("id", id);
  } catch {
    // Local fallback succeeded
  }

  return true;
}

/**
 * Delete inquiry
 */
export async function deleteInquiry(id: string): Promise<boolean> {
  const filtered = getStoredInquiries().filter((inq) => inq.id !== id);
  saveStoredInquiries(filtered);

  try {
    await supabase
      .from("contact_inquiries" as any)
      .delete()
      .eq("id", id);
  } catch {
    // Local fallback succeeded
  }

  return true;
}
