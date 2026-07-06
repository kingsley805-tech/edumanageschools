import { useCallback, useEffect, useMemo, useState } from "react";
import { Bus, Download, MapPin, Plus, Route, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useModuleAccess } from "@/modules/lib/useModuleAccess";
import { ModuleAccessDenied } from "@/modules/lib/ModuleAccessDenied";
import { downloadCsv } from "@/modules/lib/exportCsv";
import { isMissingTableError, operationsSchemaSetupMessage } from "@/modules/lib/missingSchema";
import { TransportSchemaSetupCard } from "@/modules/transport/components/TransportSchemaSetupCard";
import {
  checkTransportSchema,
  transportSchemaReady,
  type TransportSchemaStatus,
} from "@/modules/transport/lib/schema";
import {
  assignStudentTransport,
  fetchTransportBuses,
  fetchTransportReport,
  fetchTransportRoutes,
  fetchTransportStops,
  type TransportBus,
  type TransportReportRow,
  type TransportRoute,
  type TransportStop,
} from "@/modules/transport/lib/api";
import { formatMoney } from "@/lib/currency";
import { toast } from "sonner";

type StudentOption = {
  id: string;
  name: string;
  admission: string;
  class_id: string | null;
  class_name: string;
};

export default function TransportPage() {
  const { currentSchool } = useSchoolInfo();
  const schoolId = currentSchool?.id ?? null;
  const access = useModuleAccess("transport");

  const [schemaStatus, setSchemaStatus] = useState<TransportSchemaStatus | null>(null);
  const [schemaChecking, setSchemaChecking] = useState(false);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [buses, setBuses] = useState<TransportBus[]>([]);
  const [stops, setStops] = useState<TransportStop[]>([]);
  const [report, setReport] = useState<TransportReportRow[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);

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
      const status = await checkTransportSchema(schoolId);
      setSchemaStatus(status);

      const [r, b, s, rep] = await Promise.all([
        status.routes ? fetchTransportRoutes(schoolId) : Promise.resolve([] as TransportRoute[]),
        status.buses ? fetchTransportBuses(schoolId) : Promise.resolve([] as TransportBus[]),
        status.stops ? fetchTransportStops(schoolId) : Promise.resolve([] as TransportStop[]),
        status.rpcReport
          ? fetchTransportReport(schoolId).catch(() => [] as TransportReportRow[])
          : Promise.resolve([] as TransportReportRow[]),
      ]);
      setRoutes(r);
      setBuses(b);
      setStops(s);
      setReport(rep);
    } catch (e) {
      handleDbError(e as { message?: string; code?: string });
    } finally {
      setSchemaChecking(false);
    }
  }, [schoolId]);

  const loadStudents = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await supabase
      .from("students")
      .select("id, class_id, full_name, admission_number, admission_no, profiles!students_user_id_fkey(full_name), classes(name)")
      .eq("school_id", schoolId)
      .order("full_name");
    if (error) return;
    setStudents(
      (data ?? []).map((row: any) => ({
        id: row.id,
        name: row.profiles?.full_name ?? row.full_name ?? "Student",
        admission: row.admission_number ?? row.admission_no ?? "—",
        class_id: row.class_id ?? null,
        class_name: row.classes?.name ?? "Unassigned",
      })),
    );
  }, [schoolId]);

  useEffect(() => {
    void loadAll();
    void loadStudents();
  }, [loadAll, loadStudents]);

  const schemaReady = schemaStatus ? transportSchemaReady(schemaStatus) : false;

  if (!access.canView) return <ModuleAccessDenied label="Transport Management" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Bus className="h-6 w-6" />
            Transport Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage routes, buses, stops, student assignments, and transport fees.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadAll()} disabled={schemaChecking}>
          {schemaChecking ? "Checking…" : "Refresh"}
        </Button>
      </div>

      {schemaStatus && !schemaReady ? (
        <TransportSchemaSetupCard
          status={schemaStatus}
          checking={schemaChecking}
          onRecheck={() => void loadAll()}
        />
      ) : null}

      <Tabs defaultValue="assignments" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="assignments" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Assignments
          </TabsTrigger>
          <TabsTrigger value="routes" className="gap-1.5">
            <Route className="h-3.5 w-3.5" />
            Routes
          </TabsTrigger>
          <TabsTrigger value="buses" className="gap-1.5">
            <Bus className="h-3.5 w-3.5" />
            Buses
          </TabsTrigger>
          <TabsTrigger value="stops" className="gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            Stops & Fares
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="routes">
          <RoutesTab
            schoolId={schoolId}
            routes={routes}
            access={access}
            onError={handleDbError}
            onSaved={() => void loadAll()}
          />
        </TabsContent>

        <TabsContent value="buses">
          <BusesTab
            schoolId={schoolId}
            routes={routes}
            buses={buses}
            access={access}
            onError={handleDbError}
            onSaved={() => void loadAll()}
          />
        </TabsContent>

        <TabsContent value="stops">
          <StopsTab
            schoolId={schoolId}
            routes={routes}
            stops={stops}
            access={access}
            onError={handleDbError}
            onSaved={() => void loadAll()}
          />
        </TabsContent>

        <TabsContent value="assignments">
          <AssignmentsTab
            students={students}
            buses={buses}
            stops={stops}
            report={report}
            access={access}
            onAssign={async (input) => {
              try {
                const result = await assignStudentTransport(input);
                toast.success("Transport assignment saved");
                if (result.billing?.billing === "no_term") {
                  toast.message("Add an active academic term to sync transport fees to billing.");
                }
                await loadAll();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Assignment failed");
              }
            }}
          />
        </TabsContent>

        <TabsContent value="reports">
          <ReportsTab report={report} buses={buses} access={access} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RoutesTab({
  schoolId,
  routes,
  access,
  onError,
  onSaved,
}: {
  schoolId: string | null;
  routes: TransportRoute[];
  access: ReturnType<typeof useModuleAccess>;
  onError: (e: { message?: string }) => boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const create = async () => {
    if (!schoolId || !name.trim()) return;
    const { error } = await supabase.from("transport_routes").insert({
      school_id: schoolId,
      name: name.trim(),
      description: description.trim() || null,
    });
    if (error) {
      onError(error);
      return;
    }
    toast.success("Route created");
    setOpen(false);
    setName("");
    onSaved();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("transport_routes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else onSaved();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Bus routes</CardTitle>
          <CardDescription>Define route paths that buses follow.</CardDescription>
        </div>
        {access.canCreate ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add route
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add route</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Route name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="East Legon — Accra" />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </div>
                <Button onClick={() => void create()}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Route</TableHead>
              <TableHead>Description</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.description ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {access.canDelete ? (
                    <Button variant="ghost" size="icon" onClick={() => void remove(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function BusesTab({
  schoolId,
  routes,
  buses,
  access,
  onError,
  onSaved,
}: {
  schoolId: string | null;
  routes: TransportRoute[];
  buses: TransportBus[];
  access: ReturnType<typeof useModuleAccess>;
  onError: (e: { message?: string }) => boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [routeId, setRouteId] = useState("");
  const [plate, setPlate] = useState("");
  const [driver, setDriver] = useState("");
  const [capacity, setCapacity] = useState("");

  const create = async () => {
    if (!schoolId || !name.trim()) return;
    const { error } = await supabase.from("transport_buses").insert({
      school_id: schoolId,
      route_id: routeId || null,
      name: name.trim(),
      vehicle_plate: plate.trim() || null,
      driver_name: driver.trim() || null,
      capacity: capacity ? Number(capacity) : null,
      is_active: true,
    });
    if (error) {
      onError(error);
      return;
    }
    toast.success("Bus added");
    setOpen(false);
    onSaved();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("transport_buses").delete().eq("id", id);
    if (error) toast.error(error.message);
    else onSaved();
  };

  const routeName = (id: string | null) => routes.find((r) => r.id === id)?.name ?? "—";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">School buses</CardTitle>
          <CardDescription>e.g. School Bus 2 — link each bus to a route.</CardDescription>
        </div>
        {access.canCreate ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add bus
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add school bus</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Bus name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="School Bus 2" />
                </div>
                <div className="space-y-1.5">
                  <Label>Route</Label>
                  <Select value={routeId} onValueChange={setRouteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select route" />
                    </SelectTrigger>
                    <SelectContent>
                      {routes.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Plate</Label>
                    <Input value={plate} onChange={(e) => setPlate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Driver</Label>
                    <Input value={driver} onChange={(e) => setDriver(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Capacity</Label>
                  <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
                </div>
                <Button onClick={() => void create()}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bus</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Plate</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {buses.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell>{routeName(b.route_id)}</TableCell>
                <TableCell>{b.vehicle_plate ?? "—"}</TableCell>
                <TableCell>{b.driver_name ?? "—"}</TableCell>
                <TableCell>{b.capacity ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {access.canDelete ? (
                    <Button variant="ghost" size="icon" onClick={() => void remove(b.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function StopsTab({
  schoolId,
  routes,
  stops,
  access,
  onError,
  onSaved,
}: {
  schoolId: string | null;
  routes: TransportRoute[];
  stops: TransportStop[];
  access: ReturnType<typeof useModuleAccess>;
  onError: (e: { message?: string }) => boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [routeId, setRouteId] = useState("");
  const [name, setName] = useState("");
  const [fare, setFare] = useState("");

  const create = async () => {
    if (!schoolId || !routeId || !name.trim()) return;
    const { error } = await supabase.from("transport_stops").insert({
      school_id: schoolId,
      route_id: routeId,
      name: name.trim(),
      fare: Number(fare) || 0,
    });
    if (error) {
      onError(error);
      return;
    }
    toast.success("Stop added");
    setOpen(false);
    onSaved();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("transport_stops").delete().eq("id", id);
    if (error) toast.error(error.message);
    else onSaved();
  };

  const routeName = (id: string) => routes.find((r) => r.id === id)?.name ?? "—";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Stops & transport fares</CardTitle>
          <CardDescription>Pickup/drop-off locations and fare per stop (e.g. Katapor).</CardDescription>
        </div>
        {access.canCreate ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add stop
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add bus stop</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Route</Label>
                  <Select value={routeId} onValueChange={setRouteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select route" />
                    </SelectTrigger>
                    <SelectContent>
                      {routes.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Stop name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Katapor" />
                </div>
                <div className="space-y-1.5">
                  <Label>Transport fare (GHS)</Label>
                  <Input type="number" min={0} step="0.01" value={fare} onChange={(e) => setFare(e.target.value)} />
                </div>
                <Button onClick={() => void create()}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stop</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Fare</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {stops.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{routeName(s.route_id)}</TableCell>
                <TableCell>{formatMoney(s.fare, "GHS")}</TableCell>
                <TableCell className="text-right">
                  {access.canDelete ? (
                    <Button variant="ghost" size="icon" onClick={() => void remove(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AssignmentsTab({
  students,
  buses,
  stops,
  report,
  access,
  onAssign,
}: {
  students: StudentOption[];
  buses: TransportBus[];
  stops: TransportStop[];
  report: TransportReportRow[];
  access: ReturnType<typeof useModuleAccess>;
  onAssign: (input: {
    studentId: string;
    busId: string;
    stopId: string;
    status: "active" | "inactive";
    notes?: string;
  }) => Promise<void>;
}) {
  const [studentId, setStudentId] = useState("");
  const [classId, setClassId] = useState("");
  const [busId, setBusId] = useState("");
  const [stopId, setStopId] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of students) {
      const id = s.class_id ?? "__unassigned__";
      const label = s.class_name || "Unassigned";
      if (!map.has(id)) map.set(id, label);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => {
        if (a.id === "__unassigned__") return 1;
        if (b.id === "__unassigned__") return -1;
        return a.name.localeCompare(b.name);
      });
  }, [students]);

  const selectedBus = buses.find((b) => b.id === busId);
  const availableStops = useMemo(() => {
    if (!selectedBus?.route_id) return stops;
    return stops.filter((s) => s.route_id === selectedBus.route_id);
  }, [stops, selectedBus]);

  const selectedStop = availableStops.find((s) => s.id === stopId);

  const filteredStudents = useMemo(() => {
    let list = students;
    if (classId) {
      if (classId === "__unassigned__") {
        list = list.filter((s) => !s.class_id);
      } else {
        list = list.filter((s) => s.class_id === classId);
      }
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.admission.toLowerCase().includes(q) ||
        s.class_name.toLowerCase().includes(q),
    );
  }, [students, classId, search]);

  const handleClassChange = (value: string) => {
    setClassId(value);
    const stillVisible = (() => {
      if (!studentId) return true;
      const current = students.find((s) => s.id === studentId);
      if (!current) return false;
      if (!value) return true;
      if (value === "__unassigned__") return !current.class_id;
      return current.class_id === value;
    })();
    if (!stillVisible) setStudentId("");
  };

  const existing = report.find((r) => r.student_id === studentId);

  const submit = async () => {
    if (!studentId || !busId || !stopId) {
      toast.error("Select student, bus, and stop.");
      return;
    }
    await onAssign({ studentId, busId, stopId, status, notes: notes.trim() || undefined });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assign student transport</CardTitle>
          <CardDescription>
            Assign a bus and pickup location. Fare is taken from the stop and added to billing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Class</Label>
            <Select value={classId || undefined} onValueChange={handleClassChange}>
              <SelectTrigger>
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                {classOptions.map((c) => {
                  const count = students.filter((s) =>
                    c.id === "__unassigned__" ? !s.class_id : s.class_id === c.id,
                  ).length;
                  return (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({count})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {classId ? (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => handleClassChange("")}
              >
                Clear class filter
              </Button>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Search student</Label>
            <Input
              placeholder="Name or admission number"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Student</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    classId
                      ? `Select student (${filteredStudents.length} in class)`
                      : "Select class first or pick a student"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {filteredStudents.length === 0 ? (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                    {classId
                      ? "No students in this class match your search."
                      : "Select a class to narrow the list, or search by name."}
                  </div>
                ) : (
                  filteredStudents.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {s.admission}
                      {!classId ? ` (${s.class_name})` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Assigned bus</Label>
            <Select
              value={busId}
              onValueChange={(v) => {
                setBusId(v);
                setStopId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="e.g. School Bus 2" />
              </SelectTrigger>
              <SelectContent>
                {buses.filter((b) => b.is_active).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Pickup / drop-off stop</Label>
            <Select value={stopId} onValueChange={setStopId} disabled={!busId}>
              <SelectTrigger>
                <SelectValue placeholder="e.g. Katapor" />
              </SelectTrigger>
              <SelectContent>
                {availableStops.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — {formatMoney(s.fare, "GHS")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "active" | "inactive")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {selectedStop ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p>
                <span className="text-muted-foreground">Transport fare:</span>{" "}
                <strong>{formatMoney(selectedStop.fare, "GHS")}</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This amount will be assigned to the student&apos;s fee records when status is Active.
              </p>
            </div>
          ) : null}
          {existing ? (
            <p className="text-xs text-amber-600">
              Current: {existing.bus_name} · {existing.stop_name} ({existing.status})
            </p>
          ) : null}
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          {access.canEdit || access.canCreate ? (
            <Button onClick={() => void submit()}>Save assignment</Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current assignments</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto max-h-[480px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Bus</TableHead>
                <TableHead>Stop</TableHead>
                <TableHead>Fare</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.map((r) => (
                <TableRow key={r.student_id}>
                  <TableCell>
                    <div className="font-medium">{r.student_name}</div>
                    <div className="text-xs text-muted-foreground">{r.admission_number}</div>
                  </TableCell>
                  <TableCell>{r.bus_name}</TableCell>
                  <TableCell>{r.stop_name}</TableCell>
                  <TableCell>{formatMoney(r.fare_amount, "GHS")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsTab({
  report,
  buses,
  access,
}: {
  report: TransportReportRow[];
  buses: TransportBus[];
  access: ReturnType<typeof useModuleAccess>;
}) {
  const byBus = useMemo(() => {
    const map = new Map<string, TransportReportRow[]>();
    for (const row of report) {
      const list = map.get(row.bus_name) ?? [];
      list.push(row);
      map.set(row.bus_name, list);
    }
    return map;
  }, [report]);

  const exportAll = () => {
    downloadCsv(
      "transport-assignments.csv",
      ["Student", "Admission", "Class", "Bus", "Route", "Stop", "Fare", "Status"],
      report.map((r) => [
        r.student_name,
        r.admission_number,
        r.class_name,
        r.bus_name,
        r.route_name,
        r.stop_name,
        r.fare_amount,
        r.status,
      ]),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {access.canExport ? (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportAll}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        ) : null}
      </div>
      {buses.map((bus) => {
        const rows = byBus.get(bus.name) ?? [];
        const totalFare = rows.reduce((sum, r) => sum + Number(r.fare_amount), 0);
        return (
          <Card key={bus.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span>{bus.name}</span>
                <Badge variant="secondary">{rows.length} students</Badge>
              </CardTitle>
              <CardDescription>
                Total transport fees: {formatMoney(totalFare, "GHS")}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Stop</TableHead>
                    <TableHead>Fare</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        No students assigned to this bus.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => (
                      <TableRow key={r.student_id}>
                        <TableCell>
                          <div className="font-medium">{r.student_name}</div>
                          <div className="text-xs text-muted-foreground">{r.admission_number}</div>
                        </TableCell>
                        <TableCell>{r.class_name}</TableCell>
                        <TableCell>{r.stop_name}</TableCell>
                        <TableCell>{formatMoney(r.fare_amount, "GHS")}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
