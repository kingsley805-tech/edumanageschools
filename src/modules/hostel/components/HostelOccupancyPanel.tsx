import { useEffect, useMemo, useState } from "react";
import { BedDouble, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fetchBedsForRoom } from "@/modules/hostel/lib/api";
import type { HostelBed, HostelBlock, HostelRoom } from "@/modules/hostel/lib/types";
import { toast } from "sonner";

type Props = {
  rooms: HostelRoom[];
  hostels: HostelBlock[];
  schoolId: string | null;
  onSelectRoom?: (room: HostelRoom) => void;
};

const BED_COLORS: Record<HostelBed["status"], string> = {
  available: "border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  occupied: "border-blue-500/60 bg-blue-500/15 text-blue-700 dark:text-blue-300",
  maintenance: "border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

const BED_LABELS: Record<HostelBed["status"], string> = {
  available: "Available",
  occupied: "Occupied",
  maintenance: "Maintenance",
};

function BedCell({ bed, onClick }: { bed: HostelBed; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[72px] flex-col items-center justify-center rounded-lg border-2 p-2 text-center transition-all hover:scale-[1.02]",
        BED_COLORS[bed.status],
      )}
      title={bed.student_name ? `${bed.student_name} — Bed ${bed.bed_number}` : `Bed ${bed.bed_number}`}
    >
      <BedDouble className="mb-1 h-4 w-4" />
      <span className="text-xs font-semibold">Bed {bed.bed_number}</span>
      {bed.student_name ? (
        <span className="mt-0.5 line-clamp-1 text-[10px] opacity-80">{bed.student_name}</span>
      ) : (
        <span className="mt-0.5 text-[10px] opacity-70">{BED_LABELS[bed.status]}</span>
      )}
    </button>
  );
}

export function HostelOccupancyPanel({ rooms, hostels, schoolId, onSelectRoom }: Props) {
  const [hostelFilter, setHostelFilter] = useState("");
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [bedsByRoom, setBedsByRoom] = useState<Record<string, HostelBed[]>>({});
  const [loadingRoom, setLoadingRoom] = useState<string | null>(null);

  const filteredRooms = useMemo(() => {
    if (!hostelFilter) return rooms;
    return rooms.filter((r) => r.block_id === hostelFilter);
  }, [rooms, hostelFilter]);

  useEffect(() => {
    if (!hostelFilter && hostels[0]) setHostelFilter(hostels[0].id);
  }, [hostels, hostelFilter]);

  const loadBeds = async (roomId: string) => {
    if (bedsByRoom[roomId]) return;
    setLoadingRoom(roomId);
    try {
      const beds = await fetchBedsForRoom(roomId);
      setBedsByRoom((prev) => ({ ...prev, [roomId]: beds }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load beds");
    } finally {
      setLoadingRoom(null);
    }
  };

  const toggleRoom = async (room: HostelRoom) => {
    const next = expandedRoomId === room.id ? null : room.id;
    setExpandedRoomId(next);
    if (next) {
      onSelectRoom?.(room);
      await loadBeds(room.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={hostelFilter || "all"} onValueChange={(v) => setHostelFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by hostel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All hostels</SelectItem>
            {hostels.map((h) => (
              <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Available
          </Badge>
          <Badge variant="outline" className="gap-1.5 border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300">
            <span className="h-2 w-2 rounded-full bg-blue-500" /> Occupied
          </Badge>
          <Badge variant="outline" className="gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Maintenance
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredRooms.map((room) => {
          const expanded = expandedRoomId === room.id;
          const beds = bedsByRoom[room.id] ?? [];
          const loading = loadingRoom === room.id;

          return (
            <Card
              key={room.id}
              className={cn(
                "cursor-pointer transition-shadow hover:shadow-md dark:bg-[#0b0f0d] dark:border-white/10",
                expanded && "ring-2 ring-primary/30",
              )}
              onClick={() => void toggleRoom(room)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      Room {room.room_number}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {room.block_name} · {room.occupied}/{room.capacity} occupied
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {room.room_status}
                  </Badge>
                </div>
              </CardHeader>
              {expanded ? (
                <CardContent className="pt-0" onClick={(e) => e.stopPropagation()}>
                  {loading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading beds…
                    </div>
                  ) : beds.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {beds.map((bed) => (
                        <BedCell key={bed.id} bed={bed} />
                      ))}
                    </div>
                  ) : (
                    <p className="py-4 text-center text-sm text-muted-foreground">No beds configured for this room.</p>
                  )}
                </CardContent>
              ) : null}
            </Card>
          );
        })}
      </div>

      {!filteredRooms.length ? (
        <Card className="dark:bg-[#0b0f0d]">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {schoolId ? "No rooms found for the selected hostel." : "Select a school to view occupancy."}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
