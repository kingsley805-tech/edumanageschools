/** PostgREST / Supabase error when a column is missing locally or in schema cache. */
export function isMissingSchemaColumnError(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false;
  const msg = error.message ?? "";
  return (
    error.code === "PGRST204" ||
    /could not find.*column/i.test(msg) ||
    /column.*does not exist/i.test(msg) ||
    /schema cache/i.test(msg)
  );
}
