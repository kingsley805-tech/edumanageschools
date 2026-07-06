import { supabase } from "@/integrations/supabase/client";

export type TransportRoute = {
  id: string;
  name: string;
  description: string | null;
  vehicle_plate?: string | null;
  driver_name?: string | null;
  capacity?: number | null;
};

export type TransportBus = {
  id: string;
  school_id: string;
  route_id: string | null;
  name: string;
  vehicle_plate: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  capacity: number | null;
  is_active: boolean;
};

export type TransportStop = {
  id: string;
  school_id: string;
  route_id: string;
  name: string;
  fare: number;
  sort_order: number;
};

export type StudentTransportInfo = {
  assigned: boolean;
  id?: string;
  status?: string;
  fare_amount?: number;
  bus_name?: string;
  stop_name?: string;
  pickup_location?: string;
  route_name?: string;
  vehicle_plate?: string | null;
  driver_name?: string | null;
  notes?: string | null;
};

export type TransportReportRow = {
  student_id: string;
  student_name: string;
  admission_number: string;
  class_name: string;
  bus_name: string;
  route_name: string;
  stop_name: string;
  fare_amount: number;
  status: string;
};

export async function fetchTransportRoutes(schoolId: string): Promise<TransportRoute[]> {
  const { data, error } = await supabase
    .from("transport_routes")
    .select("id, name, description, vehicle_plate, driver_name, capacity")
    .eq("school_id", schoolId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as TransportRoute[];
}

export async function fetchTransportBuses(schoolId: string): Promise<TransportBus[]> {
  const { data, error } = await supabase
    .from("transport_buses")
    .select("*")
    .eq("school_id", schoolId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as TransportBus[];
}

export async function fetchTransportStops(schoolId: string): Promise<TransportStop[]> {
  const { data, error } = await supabase
    .from("transport_stops")
    .select("*")
    .eq("school_id", schoolId)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as TransportStop[];
}

export async function fetchTransportReport(schoolId: string): Promise<TransportReportRow[]> {
  const { data, error } = await supabase.rpc("get_transport_assignments_report", {
    p_school_id: schoolId,
  });
  if (error) throw error;
  return (data ?? []) as TransportReportRow[];
}

export async function fetchStudentTransportInfo(studentId: string): Promise<StudentTransportInfo> {
  const { data, error } = await supabase.rpc("get_student_transport_info", {
    p_student_id: studentId,
  });
  if (error) throw error;
  return (data ?? { assigned: false }) as StudentTransportInfo;
}

export async function assignStudentTransport(input: {
  studentId: string;
  busId: string;
  stopId: string;
  status?: "active" | "inactive";
  notes?: string | null;
}) {
  const { data, error } = await supabase.rpc("upsert_student_transport_assignment", {
    p_student_id: input.studentId,
    p_bus_id: input.busId,
    p_stop_id: input.stopId,
    p_status: input.status ?? "active",
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
  const result = data as { ok?: boolean; error?: string; billing?: Record<string, unknown> };
  if (!result?.ok) throw new Error(result?.error ?? "Could not save transport assignment");
  return result;
}
