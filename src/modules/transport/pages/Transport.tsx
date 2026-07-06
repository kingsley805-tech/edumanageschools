import { useCallback, useEffect, useState } from "react";
import { Bus, Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useModuleAccess } from "@/modules/lib/useModuleAccess";
import { ModuleAccessDenied } from "@/modules/lib/ModuleAccessDenied";
import { downloadCsv } from "@/modules/lib/exportCsv";
import { isMissingTableError, operationsSchemaSetupMessage } from "@/modules/lib/missingSchema";
import { OperationsSchemaSetupCard } from "@/modules/lib/OperationsSchemaSetupCard";
import { toast } from "sonner";

type RouteRow = {
  id: string;
  name: string;
  vehicle_plate: string | null;
  driver_name: string | null;
  capacity: number | null;
  description: string | null;
};

export default function TransportPage() {
  const { currentSchool } = useSchoolInfo();
  const schoolId = currentSchool?.id ?? null;
  const access = useModuleAccess("transport");
  const [rows, setRows] = useState<RouteRow[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");
  const [driver, setDriver] = useState("");
  const [capacity, setCapacity] = useState("");
  const [description, setDescription] = useState("");
  const [schemaMissing, setSchemaMissing] = useState(false);

  const handleDbError = (error: { code?: string; message?: string; status?: number }) => {
    if (isMissingTableError(error)) {
      setSchemaMissing(true);
      toast.error(operationsSchemaSetupMessage());
      return true;
    }
    toast.error(error.message ?? "Request failed");
    return false;
  };

  const load = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await supabase
      .from("transport_routes")
      .select("*")
      .eq("school_id", schoolId)
      .order("name");

    if (error) {
      handleDbError(error);
      return;
    }
    setSchemaMissing(false);
    setRows((data ?? []) as RouteRow[]);
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!schoolId || !name.trim()) {
      toast.error("Route name is required.");
      return;
    }
    const { error } = await supabase.from("transport_routes").insert({
      school_id: schoolId,
      name: name.trim(),
      vehicle_plate: plate.trim() || null,
      driver_name: driver.trim() || null,
      capacity: capacity ? Number(capacity) : null,
      description: description.trim() || null,
    });
    if (error) {
      handleDbError(error);
      return;
    }
    toast.success("Route added");
    setOpen(false);
    setName("");
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("transport_routes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else void load();
  };

  if (!access.canView) return <ModuleAccessDenied label="Transport" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Bus className="h-6 w-6" />
            Transport
          </h1>
          <p className="text-sm text-muted-foreground">Manage school bus routes and vehicles.</p>
        </div>
        <div className="flex gap-2">
          {access.canExport ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                downloadCsv(
                  "transport-routes.csv",
                  ["Route", "Vehicle", "Driver", "Capacity", "Description"],
                  rows.map((r) => [r.name, r.vehicle_plate, r.driver_name, r.capacity, r.description]),
                )
              }
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          ) : null}
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
                  <DialogTitle>Add transport route</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Route name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Vehicle plate</Label>
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
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                  </div>
                  <Button onClick={() => void create()}>Save route</Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>

      {schemaMissing ? (
        <OperationsSchemaSetupCard
          moduleLabel="Transport"
          quickScript="apply-transport-tables.sql"
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Routes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.vehicle_plate ?? "—"}</TableCell>
                  <TableCell>{r.driver_name ?? "—"}</TableCell>
                  <TableCell>{r.capacity ?? "—"}</TableCell>
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
    </div>
  );
}
