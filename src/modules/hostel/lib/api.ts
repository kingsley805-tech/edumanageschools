import { supabase } from "@/integrations/supabase/client";
import type {
  HostelAllocation,
  HostelBed,
  HostelBlock,
  HostelDashboardStats,
  HostelPayment,
  HostelRoom,
  StudentOption,
} from "@/modules/hostel/lib/types";

const EMPTY_STATS: HostelDashboardStats = {
  total_hostels: 0,
  total_rooms: 0,
  total_bed_capacity: 0,
  occupied_beds: 0,
  available_beds: 0,
  total_students: 0,
  male_students: 0,
  female_students: 0,
  fee_collected: 0,
  outstanding_fees: 0,
  occupancy_rate: 0,
};

export async function fetchHostelDashboardStats(schoolId: string): Promise<HostelDashboardStats> {
  const { data, error } = await supabase.rpc("get_hostel_dashboard_stats", { p_school_id: schoolId });
  if (error) throw error;
  return { ...EMPTY_STATS, ...(data as HostelDashboardStats) };
}

export async function fetchHostels(schoolId: string): Promise<HostelBlock[]> {
  const { data: blocks, error } = await supabase
    .from("hostel_blocks")
    .select("*")
    .eq("school_id", schoolId)
    .order("name");
  if (error) throw error;

  const { data: rooms } = await supabase
    .from("hostel_rooms")
    .select("block_id, capacity, occupied")
    .eq("school_id", schoolId);

  const roomStats = new Map<string, { count: number; capacity: number; occupied: number }>();
  for (const r of rooms ?? []) {
    const cur = roomStats.get(r.block_id) ?? { count: 0, capacity: 0, occupied: 0 };
    cur.count += 1;
    cur.capacity += r.capacity ?? 0;
    cur.occupied += r.occupied ?? 0;
    roomStats.set(r.block_id, cur);
  }

  return (blocks ?? []).map((b) => {
    const stats = roomStats.get(b.id) ?? { count: 0, capacity: 0, occupied: 0 };
    return {
      ...b,
      hostel_type: (b.hostel_type ?? b.gender ?? "mixed") as HostelBlock["hostel_type"],
      status: (b.status ?? "active") as HostelBlock["status"],
      room_count: stats.count,
      total_capacity: stats.capacity,
      occupied: stats.occupied,
    };
  });
}

export async function saveHostel(
  schoolId: string,
  payload: Partial<HostelBlock> & { name: string },
  id?: string,
) {
  const row = {
    school_id: schoolId,
    name: payload.name.trim(),
    hostel_type: payload.hostel_type ?? "mixed",
    gender: payload.hostel_type === "boys" ? "male" : payload.hostel_type === "girls" ? "female" : null,
    warden_name: payload.warden_name ?? null,
    warden_phone: payload.warden_phone ?? null,
    status: payload.status ?? "active",
    description: payload.description ?? null,
    capacity: payload.capacity ?? null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await supabase.from("hostel_blocks").update(row).eq("id", id);
    if (error) throw error;
    return id;
  }

  const { data, error } = await supabase.from("hostel_blocks").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function deleteHostel(id: string) {
  const { error } = await supabase.from("hostel_blocks").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchRooms(schoolId: string): Promise<HostelRoom[]> {
  const { data, error } = await supabase
    .from("hostel_rooms")
    .select("*, hostel_blocks(name, hostel_type)")
    .eq("school_id", schoolId)
    .order("room_number");
  if (error) throw error;

  return (data ?? []).map((r) => ({
    ...r,
    room_type: (r.room_type ?? "dormitory") as HostelRoom["room_type"],
    room_status: (r.room_status ?? "available") as HostelRoom["room_status"],
    monthly_fee: Number(r.monthly_fee ?? 0),
    term_fee: Number(r.term_fee ?? 0),
    block_name: (r.hostel_blocks as { name?: string } | null)?.name ?? "Hostel",
    hostel_type: (r.hostel_blocks as { hostel_type?: string } | null)?.hostel_type ?? null,
  }));
}

export async function saveRoom(
  schoolId: string,
  payload: {
    block_id: string;
    room_number: string;
    capacity: number;
    floor?: string;
    wing?: string;
    room_type?: string;
    monthly_fee?: number;
    term_fee?: number;
    room_status?: string;
    gender?: string | null;
  },
  id?: string,
) {
  const row = {
    school_id: schoolId,
    block_id: payload.block_id,
    room_number: payload.room_number.trim(),
    capacity: Math.max(1, payload.capacity),
    floor: payload.floor ?? null,
    wing: payload.wing ?? null,
    room_type: payload.room_type ?? "dormitory",
    monthly_fee: payload.monthly_fee ?? 0,
    term_fee: payload.term_fee ?? 0,
    room_status: payload.room_status ?? "available",
    gender: payload.gender ?? null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await supabase.from("hostel_rooms").update(row).eq("id", id);
    if (error) throw error;
    await ensureBedsForRoom(id, schoolId, row.capacity);
    return id;
  }

  const { data, error } = await supabase.from("hostel_rooms").insert({ ...row, occupied: 0 }).select("id").single();
  if (error) throw error;
  await ensureBedsForRoom(data.id, schoolId, row.capacity);
  return data.id;
}

export async function deleteRoom(id: string) {
  const { error } = await supabase.from("hostel_rooms").delete().eq("id", id);
  if (error) throw error;
}

export async function ensureBedsForRoom(roomId: string, schoolId: string, capacity: number) {
  const { data: existing } = await supabase.from("hostel_beds").select("id, bed_number").eq("room_id", roomId);
  const have = existing?.length ?? 0;
  if (have >= capacity) return;

  const inserts = [];
  for (let i = have + 1; i <= capacity; i++) {
    inserts.push({ school_id: schoolId, room_id: roomId, bed_number: String(i), status: "available" });
  }
  if (inserts.length) {
    const { error } = await supabase.from("hostel_beds").insert(inserts);
    if (error) throw error;
  }
}

export async function fetchBedsForRoom(roomId: string): Promise<HostelBed[]> {
  const { data: beds, error } = await supabase
    .from("hostel_beds")
    .select("id, room_id, bed_number, status")
    .eq("room_id", roomId)
    .order("bed_number");
  if (error) throw error;

  const { data: allocations } = await supabase
    .from("hostel_allocations")
    .select("id, bed_id, students(full_name, profiles:user_id(full_name))")
    .eq("room_id", roomId)
    .in("allocation_status", ["active", "pending"]);

  const allocMap = new Map<string, { id: string; name: string }>();
  for (const a of allocations ?? []) {
    if (!a.bed_id) continue;
    const st = a.students as { full_name?: string; profiles?: { full_name?: string } } | null;
    allocMap.set(a.bed_id, {
      id: a.id,
      name: st?.profiles?.full_name ?? st?.full_name ?? "Student",
    });
  }

  return (beds ?? []).map((b) => ({
    ...b,
    status: b.status as HostelBed["status"],
    student_name: allocMap.get(b.id)?.name ?? null,
    allocation_id: allocMap.get(b.id)?.id ?? null,
  }));
}

function mapAllocation(row: Record<string, unknown>): HostelAllocation {
  const student = row.students as {
    full_name?: string;
    admission_number?: string;
    admission_no?: string;
    gender?: string;
    profiles?: { full_name?: string; avatar_url?: string };
    classes?: { name?: string };
    guardian?: { phone?: string; emergency_contact?: string; profiles?: { full_name?: string } };
  } | null;
  const block = row.hostel_blocks as { name?: string } | null;
  const room = row.hostel_rooms as { room_number?: string } | null;
  const bed = row.hostel_beds as { bed_number?: string } | null;

  return {
    id: row.id as string,
    school_id: row.school_id as string,
    student_id: row.student_id as string,
    block_id: row.block_id as string,
    room_id: row.room_id as string,
    bed_id: (row.bed_id as string) ?? null,
    check_in_date: row.check_in_date as string,
    expected_check_out_date: (row.expected_check_out_date as string) ?? null,
    actual_check_out_date: (row.actual_check_out_date as string) ?? null,
    fee_amount: Number(row.fee_amount ?? 0),
    amount_paid: Number(row.amount_paid ?? 0),
    allocation_status: row.allocation_status as HostelAllocation["allocation_status"],
    payment_status: row.payment_status as HostelAllocation["payment_status"],
    notes: (row.notes as string) ?? null,
    student_name: student?.profiles?.full_name ?? student?.full_name ?? "Student",
    admission_number: student?.admission_number ?? student?.admission_no ?? "—",
    gender: student?.gender ?? null,
    class_name: student?.classes?.name ?? "—",
    avatar_url: student?.profiles?.avatar_url ?? null,
    parent_name: student?.guardian?.profiles?.full_name ?? null,
    parent_phone: student?.guardian?.phone ?? student?.guardian?.emergency_contact ?? null,
    hostel_name: block?.name ?? "—",
    room_number: room?.room_number ?? "—",
    bed_number: bed?.bed_number ?? null,
  };
}

export async function fetchAllocations(schoolId: string): Promise<HostelAllocation[]> {
  const { data, error } = await supabase
    .from("hostel_allocations")
    .select(`
      *,
      students(full_name, admission_number, admission_no, gender, profiles:user_id(full_name, avatar_url), classes(name),
        guardian:parents!students_guardian_id_fkey(phone, emergency_contact, profiles:user_id(full_name))),
      hostel_blocks(name),
      hostel_rooms(room_number),
      hostel_beds(bed_number)
    `)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapAllocation(r as Record<string, unknown>));
}

export async function assignStudentHostel(params: {
  student_id: string;
  block_id: string;
  room_id: string;
  bed_id?: string;
  check_in_date?: string;
  expected_check_out_date?: string;
  fee_amount?: number;
}) {
  const { data, error } = await supabase.rpc("upsert_hostel_allocation", {
    p_student_id: params.student_id,
    p_block_id: params.block_id,
    p_room_id: params.room_id,
    p_bed_id: params.bed_id ?? null,
    p_check_in_date: params.check_in_date ?? new Date().toISOString().slice(0, 10),
    p_expected_check_out_date: params.expected_check_out_date ?? null,
    p_fee_amount: params.fee_amount ?? null,
    p_allocation_status: "active",
    p_notes: null,
  });
  if (error) throw error;
  const res = data as { ok?: boolean; error?: string };
  if (!res?.ok) throw new Error(res?.error ?? "Assignment failed");
  return res;
}

export async function checkoutAllocation(allocationId: string) {
  const { data, error } = await supabase.rpc("checkout_hostel_allocation", {
    p_allocation_id: allocationId,
  });
  if (error) throw error;
  const res = data as { ok?: boolean; error?: string };
  if (!res?.ok) throw new Error(res?.error ?? "Checkout failed");
}

export async function fetchPayments(schoolId: string): Promise<HostelPayment[]> {
  const { data, error } = await supabase
    .from("hostel_payments")
    .select(`
      *,
      students(full_name, admission_number, admission_no, profiles:user_id(full_name)),
      hostel_allocations(hostel_blocks(name), hostel_rooms(room_number))
    `)
    .eq("school_id", schoolId)
    .order("payment_date", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((p) => {
    const student = p.students as { full_name?: string; admission_number?: string; admission_no?: string; profiles?: { full_name?: string } } | null;
    const alloc = p.hostel_allocations as { hostel_blocks?: { name?: string }; hostel_rooms?: { room_number?: string } } | null;
    return {
      id: p.id,
      allocation_id: p.allocation_id,
      student_id: p.student_id,
      amount: Number(p.amount),
      payment_date: p.payment_date,
      payment_method: p.payment_method,
      receipt_number: p.receipt_number,
      notes: p.notes,
      student_name: student?.profiles?.full_name ?? student?.full_name ?? "Student",
      admission_number: student?.admission_number ?? student?.admission_no ?? "—",
      hostel_name: alloc?.hostel_blocks?.name ?? "—",
      room_number: alloc?.hostel_rooms?.room_number ?? "—",
    };
  });
}

export async function recordHostelPayment(params: {
  allocation_id: string;
  amount: number;
  payment_method?: string;
  receipt_number?: string;
  payment_date?: string;
  notes?: string;
}) {
  const { data, error } = await supabase.rpc("record_hostel_payment", {
    p_allocation_id: params.allocation_id,
    p_amount: params.amount,
    p_payment_method: params.payment_method ?? "cash",
    p_receipt_number: params.receipt_number ?? null,
    p_payment_date: params.payment_date ?? new Date().toISOString().slice(0, 10),
    p_notes: params.notes ?? null,
  });
  if (error) throw error;
  const res = data as { ok?: boolean; error?: string; receipt_number?: string };
  if (!res?.ok) throw new Error(res?.error ?? "Payment failed");
  return res;
}

export async function fetchStudentOptions(schoolId: string): Promise<StudentOption[]> {
  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, gender, admission_number, admission_no, profiles:user_id(full_name, avatar_url), classes(name)")
    .eq("school_id", schoolId)
    .order("full_name");
  if (error) throw error;

  return (data ?? []).map((s) => ({
    id: s.id,
    name: (s.profiles as { full_name?: string } | null)?.full_name ?? s.full_name ?? "Student",
    admission: s.admission_number ?? s.admission_no ?? "—",
    gender: s.gender,
    class_name: (s.classes as { name?: string } | null)?.name ?? "—",
    avatar_url: (s.profiles as { avatar_url?: string } | null)?.avatar_url ?? null,
  }));
}
