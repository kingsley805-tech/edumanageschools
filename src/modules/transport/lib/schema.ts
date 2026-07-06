import { supabase } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/modules/lib/missingSchema";

export type TransportSchemaStatus = {
  routes: boolean;
  buses: boolean;
  stops: boolean;
  assignments: boolean;
  rpcReport: boolean;
  rpcAssign: boolean;
};

async function tableExists(table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select("id", { head: true, count: "exact" }).limit(1);
  if (!error) return true;
  return !isMissingTableError(error);
}

async function rpcExists(
  fn: string,
  args: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await supabase.rpc(fn, args);
  if (!error) return true;
  if (isMissingTableError(error)) return false;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  if (code === "PGRST202" || msg.includes(`function public.${fn}`) || msg.includes("schema cache")) {
    return false;
  }
  // Business/validation errors mean the RPC exists.
  return true;
}

/** Probe which transport objects exist in the connected Supabase project. */
export async function checkTransportSchema(schoolId: string): Promise<TransportSchemaStatus> {
  const [routes, buses, stops, assignments] = await Promise.all([
    tableExists("transport_routes"),
    tableExists("transport_buses"),
    tableExists("transport_stops"),
    tableExists("student_transport_assignments"),
  ]);

  const [rpcReport, rpcAssign] = routes
    ? await Promise.all([
        rpcExists("get_transport_assignments_report", { p_school_id: schoolId }),
        rpcExists("upsert_student_transport_assignment", {
          p_student_id: "00000000-0000-0000-0000-000000000000",
          p_bus_id: "00000000-0000-0000-0000-000000000000",
          p_stop_id: "00000000-0000-0000-0000-000000000000",
        }),
      ])
    : [false, false];

  return { routes, buses, stops, assignments, rpcReport, rpcAssign };
}

export function transportSchemaReady(status: TransportSchemaStatus): boolean {
  return (
    status.routes &&
    status.buses &&
    status.stops &&
    status.assignments &&
    status.rpcReport &&
    status.rpcAssign
  );
}

export function transportSchemaMissingLabels(status: TransportSchemaStatus): string[] {
  const missing: string[] = [];
  if (!status.routes) missing.push("transport_routes");
  if (!status.buses) missing.push("transport_buses");
  if (!status.stops) missing.push("transport_stops");
  if (!status.assignments) missing.push("student_transport_assignments");
  if (status.routes && !status.rpcReport) missing.push("get_transport_assignments_report (RPC)");
  if (status.routes && !status.rpcAssign) missing.push("upsert_student_transport_assignment (RPC)");
  return missing;
}
