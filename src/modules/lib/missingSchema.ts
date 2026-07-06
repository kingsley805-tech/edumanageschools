const OPERATIONS_SETUP_HINT =
  "Database tables are not set up yet. In Supabase SQL Editor, run public/sql/apply-operations-modules.sql once (creates Transport, Hostel, Library, Inventory, HR), then NOTIFY pgrst, 'reload schema';";

export function isMissingTableError(error: { code?: string; message?: string; status?: number } | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "PGRST202" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    error.status === 404 ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

export function operationsSchemaSetupMessage(): string {
  return OPERATIONS_SETUP_HINT;
}
