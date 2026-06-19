type SupabaseLikeError = { code?: string; message?: string } | null;

/** PostgREST / Supabase error when a column is missing locally or in schema cache. */
export function isMissingSchemaColumnError(error: SupabaseLikeError): boolean {
  if (!error) return false;
  const msg = error.message ?? "";
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /report_theme_primary/i.test(msg) ||
    /could not find.*column/i.test(msg) ||
    /column.*does not exist/i.test(msg)
  );
}

/** PostgREST error when a table is missing (e.g. migrations not applied). */
export function isMissingSchemaTableError(error: SupabaseLikeError): boolean {
  if (!error) return false;
  const msg = error.message ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /could not find the table/i.test(msg) ||
    /could not find.*table/i.test(msg) ||
    /relation.*does not exist/i.test(msg)
  );
}

export function isMissingSchemaError(error: SupabaseLikeError): boolean {
  return isMissingSchemaTableError(error) || isMissingSchemaColumnError(error);
}

/** PostgREST error when an RPC/function is missing (404 or schema cache). */
export function isMissingRpcError(
  error: SupabaseLikeError & { status?: number } | null,
): boolean {
  if (!error) return false;
  if (error.status === 404) return true;
  if (error.code === "PGRST202" || error.code === "42883") return true;
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("could not find the function") ||
    (msg.includes("function") && msg.includes("does not exist"))
  );
}

const REPORT_SETUP_SQL_PATH = "supabase/scripts/apply-report-system.sql";
const SUPABASE_SQL_EDITOR_URL =
  "https://supabase.com/dashboard/project/xbhhpjtwawfawifhpxbe/sql/new";

/** User-facing hint when report tables/columns have not been migrated yet. */
export function getReportDatabaseSetupHint(error: SupabaseLikeError): string | null {
  if (!isMissingSchemaError(error)) return null;
  return `Report database tables are not set up yet. Run the SQL in ${REPORT_SETUP_SQL_PATH} (or open Supabase SQL Editor), execute it, then refresh this page.`;
}

export function getReportDatabaseSetupUrl(): string {
  return SUPABASE_SQL_EDITOR_URL;
}
