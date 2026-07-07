import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BedDouble,
  Building2,
  CreditCard,
  DoorOpen,
  LayoutGrid,
  RefreshCw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useSchoolCurrency } from "@/hooks/useSchoolCurrency";
import { useModuleAccess } from "@/modules/lib/useModuleAccess";
import { ModuleAccessDenied } from "@/modules/lib/ModuleAccessDenied";
import { isMissingTableError, operationsSchemaSetupMessage } from "@/modules/lib/missingSchema";
import { HostelSchemaSetupCard } from "@/modules/hostel/components/HostelSchemaSetupCard";
import { HostelDashboardPanel } from "@/modules/hostel/components/HostelDashboardPanel";
import { HostelHostelsPanel } from "@/modules/hostel/components/HostelHostelsPanel";
import { HostelRoomsPanel } from "@/modules/hostel/components/HostelRoomsPanel";
import { HostelAllocationsPanel } from "@/modules/hostel/components/HostelAllocationsPanel";
import { HostelFeesPanel } from "@/modules/hostel/components/HostelFeesPanel";
import { HostelOccupancyPanel } from "@/modules/hostel/components/HostelOccupancyPanel";
import { HostelReportsPanel } from "@/modules/hostel/components/HostelReportsPanel";
import {
  fetchAllocations,
  fetchHostelDashboardStats,
  fetchHostels,
  fetchPayments,
  fetchRooms,
  fetchStudentOptions,
} from "@/modules/hostel/lib/api";
import { checkHostelSchema, hostelSchemaReady, type HostelSchemaStatus } from "@/modules/hostel/lib/schema";
import type {
  HostelAllocation,
  HostelBlock,
  HostelDashboardStats,
  HostelPayment,
  HostelRoom,
  StudentOption,
} from "@/modules/hostel/lib/types";
import { toast } from "sonner";

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

export default function HostelPage() {
  const { currentSchool } = useSchoolInfo();
  const schoolId = currentSchool?.id ?? null;
  const { currency, format } = useSchoolCurrency();
  const access = useModuleAccess("hostel");

  const [schemaStatus, setSchemaStatus] = useState<HostelSchemaStatus | null>(null);
  const [schemaChecking, setSchemaChecking] = useState(false);
  const [stats, setStats] = useState<HostelDashboardStats>(EMPTY_STATS);
  const [hostels, setHostels] = useState<HostelBlock[]>([]);
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [allocations, setAllocations] = useState<HostelAllocation[]>([]);
  const [payments, setPayments] = useState<HostelPayment[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);

  const accessProps = useMemo(
    () => ({ canCreate: access.canCreate, canEdit: access.canEdit, canDelete: access.canDelete }),
    [access.canCreate, access.canEdit, access.canDelete],
  );

  const defaultFilters = useMemo(
    () => ({ search: "", hostelId: "", paymentStatus: "", occupancyStatus: "", className: "" }),
    [],
  );

  const handleDbError = (error: { code?: string; message?: string; status?: number }) => {
    if (isMissingTableError(error)) {
      toast.error(operationsSchemaSetupMessage());
      return true;
    }
    toast.error(error.message ?? "Request failed");
    return false;
  };

  const loadAll = useCallback(async () => {
    if (!schoolId) return;
    setSchemaChecking(true);
    try {
      const status = await checkHostelSchema(schoolId);
      setSchemaStatus(status);

      if (!status.blocks) {
        setHostels([]);
        setRooms([]);
        setAllocations([]);
        setPayments([]);
        setStats(EMPTY_STATS);
        return;
      }

      const [hostelRows, roomRows] = await Promise.all([
        fetchHostels(schoolId),
        status.rooms ? fetchRooms(schoolId) : Promise.resolve([] as HostelRoom[]),
      ]);
      setHostels(hostelRows);
      setRooms(roomRows);

      if (status.allocations) {
        const [allocRows, payRows, studentRows] = await Promise.all([
          fetchAllocations(schoolId),
          status.payments ? fetchPayments(schoolId) : Promise.resolve([] as HostelPayment[]),
          fetchStudentOptions(schoolId),
        ]);
        setAllocations(allocRows);
        setPayments(payRows);
        setStudents(studentRows);
      } else {
        setAllocations([]);
        setPayments([]);
        setStudents(await fetchStudentOptions(schoolId).catch(() => []));
      }

      if (status.rpcStats) {
        try {
          setStats(await fetchHostelDashboardStats(schoolId));
        } catch {
          setStats(EMPTY_STATS);
        }
      } else {
        setStats({
          ...EMPTY_STATS,
          total_hostels: hostelRows.filter((h) => h.status === "active").length,
          total_rooms: roomRows.length,
          total_bed_capacity: roomRows.reduce((s, r) => s + r.capacity, 0),
          occupied_beds: roomRows.reduce((s, r) => s + r.occupied, 0),
          available_beds: roomRows.reduce((s, r) => s + Math.max(r.capacity - r.occupied, 0), 0),
        });
      }
    } catch (e) {
      handleDbError(e as { message?: string; code?: string });
    } finally {
      setSchemaChecking(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const schemaReady = schemaStatus ? hostelSchemaReady(schemaStatus) : false;
  const fmt = useMemo(() => (v: number) => format(v, currency, { maximumFractionDigits: 0 }), [format, currency]);

  if (!access.canView) return <ModuleAccessDenied label="Hostel Management" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BedDouble className="h-6 w-6" />
            Hostel Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Hostels, rooms, student allocations, fees, and occupancy analytics
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadAll()} disabled={schemaChecking} className="gap-1.5">
          <RefreshCw className={`h-4 w-4 ${schemaChecking ? "animate-spin" : ""}`} />
          {schemaChecking ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {schemaStatus && !schemaReady ? (
        <HostelSchemaSetupCard
          status={schemaStatus}
          checking={schemaChecking}
          onRecheck={() => void loadAll()}
        />
      ) : null}

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="dashboard" className="gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="hostels" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Hostels
          </TabsTrigger>
          <TabsTrigger value="rooms" className="gap-1.5">
            <DoorOpen className="h-3.5 w-3.5" />
            Rooms
          </TabsTrigger>
          <TabsTrigger value="allocations" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Allocations
          </TabsTrigger>
          <TabsTrigger value="fees" className="gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            Fees
          </TabsTrigger>
          <TabsTrigger value="occupancy" className="gap-1.5">
            <BedDouble className="h-3.5 w-3.5" />
            Occupancy
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <HostelDashboardPanel stats={stats} currency={currency} formatCurrency={fmt} />
        </TabsContent>

        <TabsContent value="hostels">
          <HostelHostelsPanel
            hostels={hostels}
            schoolId={schoolId}
            access={accessProps}
            onRefresh={() => void loadAll()}
          />
        </TabsContent>

        <TabsContent value="rooms">
          <HostelRoomsPanel
            rooms={rooms}
            hostels={hostels}
            schoolId={schoolId}
            access={accessProps}
            onRefresh={() => void loadAll()}
          />
        </TabsContent>

        <TabsContent value="allocations">
          <HostelAllocationsPanel
            allocations={allocations}
            students={students}
            hostels={hostels}
            rooms={rooms}
            schoolId={schoolId}
            access={accessProps}
            filters={defaultFilters}
            onRefresh={() => void loadAll()}
          />
        </TabsContent>

        <TabsContent value="fees">
          <HostelFeesPanel
            payments={payments}
            allocations={allocations.filter((a) => a.allocation_status !== "checked_out")}
            schoolId={schoolId}
            access={accessProps}
            onRefresh={() => void loadAll()}
          />
        </TabsContent>

        <TabsContent value="occupancy">
          <HostelOccupancyPanel rooms={rooms} hostels={hostels} schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="reports">
          <HostelReportsPanel
            stats={stats}
            allocations={allocations}
            rooms={rooms}
            payments={payments}
            currency={currency}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
