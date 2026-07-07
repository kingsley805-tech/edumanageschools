export type HostelType = "boys" | "girls" | "mixed";
export type HostelStatus = "active" | "inactive";
export type RoomType = "single" | "double" | "triple" | "dormitory";
export type RoomStatus = "available" | "full" | "maintenance";
export type BedStatus = "available" | "occupied" | "maintenance";
export type AllocationStatus = "active" | "pending" | "checked_out";
export type PaymentStatus = "paid" | "partial" | "unpaid";

export type HostelDashboardStats = {
  total_hostels: number;
  total_rooms: number;
  total_bed_capacity: number;
  occupied_beds: number;
  available_beds: number;
  total_students: number;
  male_students: number;
  female_students: number;
  fee_collected: number;
  outstanding_fees: number;
  occupancy_rate: number;
};

export type HostelBlock = {
  id: string;
  school_id: string;
  name: string;
  hostel_type: HostelType | null;
  gender: string | null;
  capacity: number | null;
  warden_name: string | null;
  warden_phone: string | null;
  warden_teacher_id: string | null;
  status: HostelStatus;
  description: string | null;
  room_count?: number;
  occupied?: number;
  total_capacity?: number;
};

export type HostelRoom = {
  id: string;
  school_id: string;
  block_id: string;
  room_number: string;
  capacity: number;
  occupied: number;
  gender: string | null;
  floor: string | null;
  wing: string | null;
  room_type: RoomType;
  monthly_fee: number;
  term_fee: number;
  room_status: RoomStatus;
  block_name?: string;
  hostel_type?: string | null;
};

export type HostelBed = {
  id: string;
  room_id: string;
  bed_number: string;
  status: BedStatus;
  student_name?: string | null;
  allocation_id?: string | null;
};

export type HostelAllocation = {
  id: string;
  school_id: string;
  student_id: string;
  block_id: string;
  room_id: string;
  bed_id: string | null;
  check_in_date: string;
  expected_check_out_date: string | null;
  actual_check_out_date: string | null;
  fee_amount: number;
  amount_paid: number;
  allocation_status: AllocationStatus;
  payment_status: PaymentStatus;
  notes: string | null;
  student_name: string;
  admission_number: string;
  gender: string | null;
  class_name: string;
  avatar_url: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  hostel_name: string;
  room_number: string;
  bed_number: string | null;
};

export type HostelPayment = {
  id: string;
  allocation_id: string;
  student_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  receipt_number: string | null;
  notes: string | null;
  student_name: string;
  admission_number: string;
  hostel_name: string;
  room_number: string;
};

export type StudentOption = {
  id: string;
  name: string;
  admission: string;
  gender: string | null;
  class_name: string;
  avatar_url: string | null;
};
