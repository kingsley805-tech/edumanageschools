import { supabase } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/modules/lib/missingSchema";

export type WaecSchemaStatus = {
  subjects: boolean;
  questions: boolean;
  sessions: boolean;
  rpcDashboard: boolean;
  rpcSubmit: boolean;
};

async function tableExists(table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select("id", { head: true, count: "exact" }).limit(1);
  if (!error) return true;
  return !isMissingTableError(error);
}

export async function checkWaecSchema(): Promise<WaecSchemaStatus> {
  const [subjects, questions, sessions] = await Promise.all([
    tableExists("waec_subjects"),
    tableExists("waec_questions"),
    tableExists("waec_practice_sessions"),
  ]);

  let rpcDashboard = false;
  let rpcSubmit = false;
  if (sessions) {
    const { error: dErr } = await supabase.rpc("get_waec_student_dashboard", {
      p_user_id: "00000000-0000-0000-0000-000000000000",
    });
    rpcDashboard = !dErr || !isMissingTableError(dErr);

    const { error: sErr } = await supabase.rpc("submit_waec_session", {
      p_session_id: "00000000-0000-0000-0000-000000000000",
    });
    rpcSubmit = !sErr || !isMissingTableError(sErr);
  }

  return { subjects, questions, sessions, rpcDashboard, rpcSubmit };
}

export function waecSchemaReady(status: WaecSchemaStatus): boolean {
  return status.subjects && status.questions && status.sessions;
}
