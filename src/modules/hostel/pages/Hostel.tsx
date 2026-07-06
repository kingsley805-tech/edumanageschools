import { useCallback, useEffect, useState } from "react";
import { BedDouble, Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type RoomRow = {
  id: string;
  block_name: string;
  room_number: string;
  capacity: number;
  occupied: number;
  gender: string | null;
};

export default function HostelPage() {
  const { currentSchool } = useSchoolInfo();
  const schoolId = currentSchool?.id ?? null;
  const access = useModuleAccess("hostel");
  const [rows, setRows] = useState<RoomRow[]>([]);
  const [open, setOpen] = useState(false);
  const [blockName, setBlockName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [gender, setGender] = useState("mixed");
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
      .from("hostel_rooms")
      .select("id, block_id, room_number, capacity, occupied, gender")
      .eq("school_id", schoolId)
      .order("room_number");

    if (error) {
      handleDbError(error);
      return;
    }

    setSchemaMissing(false);

    const blockIds = [...new Set((data ?? []).map((r) => r.block_id))];
    const blockMap = new Map<string, string>();
    if (blockIds.length) {
      const { data: blocks, error: blocksError } = await supabase
        .from("hostel_blocks")
        .select("id, name")
        .in("id", blockIds);
      if (blocksError) {
        handleDbError(blocksError);
        return;
      }
      for (const b of blocks ?? []) {
        blockMap.set(b.id, b.name);
      }
    }

    setRows(
      (data ?? []).map((r) => ({
        id: r.id,
        block_name: blockMap.get(r.block_id) ?? "Block",
        room_number: r.room_number,
        capacity: r.capacity,
        occupied: r.occupied,
        gender: r.gender,
      })),
    );
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!schoolId || !blockName.trim() || !roomNumber.trim()) {
      toast.error("Block and room number are required.");
      return;
    }

    let blockId: string | null = null;
    const { data: existing, error: existingError } = await supabase
      .from("hostel_blocks")
      .select("id")
      .eq("school_id", schoolId)
      .eq("name", blockName.trim())
      .maybeSingle();

    if (existingError) {
      handleDbError(existingError);
      return;
    }

    if (existing?.id) {
      blockId = existing.id;
    } else {
      const { data: created, error: blockErr } = await supabase
        .from("hostel_blocks")
        .insert({ school_id: schoolId, name: blockName.trim(), gender: gender === "mixed" ? null : gender })
        .select("id")
        .single();
      if (blockErr) {
        handleDbError(blockErr);
        return;
      }
      blockId = created.id;
    }

    const { error } = await supabase.from("hostel_rooms").insert({
      school_id: schoolId,
      block_id: blockId,
      room_number: roomNumber.trim(),
      capacity: Math.max(1, Number(capacity) || 1),
      occupied: 0,
      gender: gender === "mixed" ? null : gender,
    });
    if (error) {
      handleDbError(error);
      return;
    }
    toast.success("Room added");
    setOpen(false);
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("hostel_rooms").delete().eq("id", id);
    if (error) toast.error(error.message);
    else void load();
  };

  if (!access.canView) return <ModuleAccessDenied label="Hostel" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BedDouble className="h-6 w-6" />
            Hostel
          </h1>
          <p className="text-sm text-muted-foreground">Manage hostel blocks, rooms, and occupancy.</p>
        </div>
        <div className="flex gap-2">
          {access.canExport ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                downloadCsv(
                  "hostel-rooms.csv",
                  ["Block", "Room", "Capacity", "Occupied", "Gender"],
                  rows.map((r) => [r.block_name, r.room_number, r.capacity, r.occupied, r.gender]),
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
                  Add room
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add hostel room</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Block name</Label>
                    <Input value={blockName} onChange={(e) => setBlockName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Room number</Label>
                    <Input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Capacity</Label>
                      <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Gender</Label>
                      <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mixed">Mixed</SelectItem>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={() => void create()}>Save room</Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>

      {schemaMissing ? (
        <OperationsSchemaSetupCard moduleLabel="Hostel" quickScript="apply-hostel-tables.sql" />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rooms</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Block</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Occupied</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.block_name}</TableCell>
                  <TableCell className="font-medium">{r.room_number}</TableCell>
                  <TableCell>{r.capacity}</TableCell>
                  <TableCell>{r.occupied}</TableCell>
                  <TableCell>{r.gender ?? "mixed"}</TableCell>
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
