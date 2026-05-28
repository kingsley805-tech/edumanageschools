import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY_FEE_CATEGORIES = "school_hub_billing_fee_categories_available";
const SESSION_KEY_ACADEMIC_CALENDAR = "school_hub_academic_calendar_available";
const SESSION_KEY_BILLING_INVOICES = "school_hub_billing_invoices_available";

let feeCategoriesAvailable: boolean | null = null;
let feeCategoriesProbe: Promise<boolean> | null = null;
let academicCalendarAvailable: boolean | null = null;
let academicCalendarProbe: Promise<boolean> | null = null;
let billingInvoicesAvailable: boolean | null = null;
let billingInvoicesProbe: Promise<boolean> | null = null;

export function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table") ||
    (msg.includes("does not exist") &&
      (msg.includes("fee_categories") ||
        msg.includes("academic_years") ||
        msg.includes("academic_year") ||
        msg.includes("billing_invoices") ||
        msg.includes("billing_invoice")))
  );
}

function readSessionFlag(key: string): boolean | null {
  try {
    const v = sessionStorage.getItem(key);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    /* ignore */
  }
  return null;
}

function writeSessionFlag(key: string, ok: boolean) {
  try {
    if (ok) sessionStorage.setItem(key, "1");
    else sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Probe whether billing fee_categories exists (one check per session). */
export async function isBillingFeeCategoriesAvailable(): Promise<boolean> {
  if (feeCategoriesAvailable !== null) return feeCategoriesAvailable;

  const cached = readSessionFlag(SESSION_KEY_FEE_CATEGORIES);
  if (cached !== null) {
    feeCategoriesAvailable = cached;
    return cached;
  }

  if (!feeCategoriesProbe) {
    feeCategoriesProbe = (async () => {
      const { error } = await supabase.from("fee_categories").select("id").limit(1);
      if (!error) {
        feeCategoriesAvailable = true;
        writeSessionFlag(SESSION_KEY_FEE_CATEGORIES, true);
        return true;
      }
      if (isMissingTableError(error)) {
        feeCategoriesAvailable = false;
        writeSessionFlag(SESSION_KEY_FEE_CATEGORIES, false);
        feeCategoriesProbe = null;
        return false;
      }
      feeCategoriesAvailable = true;
      writeSessionFlag(SESSION_KEY_FEE_CATEGORIES, true);
      return true;
    })();
  }
  return feeCategoriesProbe;
}

/** Probe whether academic_years exists (one check per session). */
export async function isAcademicCalendarAvailable(): Promise<boolean> {
  if (academicCalendarAvailable !== null) return academicCalendarAvailable;

  const cached = readSessionFlag(SESSION_KEY_ACADEMIC_CALENDAR);
  if (cached !== null) {
    academicCalendarAvailable = cached;
    return cached;
  }

  if (!academicCalendarProbe) {
    academicCalendarProbe = (async () => {
      const { error } = await supabase.from("academic_years").select("id").limit(1);
      if (!error) {
        academicCalendarAvailable = true;
        writeSessionFlag(SESSION_KEY_ACADEMIC_CALENDAR, true);
        return true;
      }
      if (isMissingTableError(error)) {
        academicCalendarAvailable = false;
        writeSessionFlag(SESSION_KEY_ACADEMIC_CALENDAR, false);
        academicCalendarProbe = null;
        return false;
      }
      academicCalendarAvailable = true;
      writeSessionFlag(SESSION_KEY_ACADEMIC_CALENDAR, true);
      return true;
    })();
  }
  return academicCalendarProbe;
}

/** Probe whether billing_invoices exists (one check per session). */
export async function isBillingInvoicesAvailable(): Promise<boolean> {
  if (billingInvoicesAvailable !== null) return billingInvoicesAvailable;

  const cached = readSessionFlag(SESSION_KEY_BILLING_INVOICES);
  if (cached !== null) {
    billingInvoicesAvailable = cached;
    return cached;
  }

  if (!billingInvoicesProbe) {
    billingInvoicesProbe = (async () => {
      const { error } = await supabase.from("billing_invoices").select("id").limit(1);
      if (!error) {
        billingInvoicesAvailable = true;
        writeSessionFlag(SESSION_KEY_BILLING_INVOICES, true);
        return true;
      }
      if (isMissingTableError(error)) {
        billingInvoicesAvailable = false;
        writeSessionFlag(SESSION_KEY_BILLING_INVOICES, false);
        billingInvoicesProbe = null;
        return false;
      }
      billingInvoicesAvailable = true;
      writeSessionFlag(SESSION_KEY_BILLING_INVOICES, true);
      return true;
    })();
  }
  return billingInvoicesProbe;
}

export function resetBillingAvailabilityProbe(): void {
  feeCategoriesAvailable = null;
  feeCategoriesProbe = null;
  academicCalendarAvailable = null;
  academicCalendarProbe = null;
  billingInvoicesAvailable = null;
  billingInvoicesProbe = null;
  try {
    sessionStorage.removeItem(SESSION_KEY_FEE_CATEGORIES);
    sessionStorage.removeItem(SESSION_KEY_ACADEMIC_CALENDAR);
    sessionStorage.removeItem(SESSION_KEY_BILLING_INVOICES);
  } catch {
    /* ignore */
  }
}

export const BILLING_SETUP_SQL_PATH = "supabase/scripts/apply-all-missing-tables.sql";
export const ACADEMIC_CALENDAR_SQL_PATH = "supabase/scripts/apply-academic-calendar.sql";
export const BILLING_INVOICES_SQL_PATH = "supabase/scripts/apply-billing-system.sql";
