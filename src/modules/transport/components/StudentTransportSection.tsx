import { useEffect, useState } from "react";
import { Bus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { fetchStudentTransportInfo, type StudentTransportInfo } from "@/modules/transport/lib/api";
import { formatMoney } from "@/lib/currency";

type Props = {
  studentId: string;
};

export function StudentTransportSection({ studentId }: Props) {
  const [info, setInfo] = useState<StudentTransportInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchStudentTransportInfo(studentId)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch(() => {
        if (!cancelled) setInfo({ assigned: false });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading transport…</p>;
  }

  if (!info?.assigned) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No school transport assigned. An administrator can assign a bus and pickup stop from Transport Management.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <Label className="text-xs text-muted-foreground">Assigned bus</Label>
        <p className="font-medium flex items-center gap-1.5">
          <Bus className="h-4 w-4 text-primary" />
          {info.bus_name}
        </p>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Pickup / drop-off</Label>
        <p className="font-medium">{info.pickup_location ?? info.stop_name}</p>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Transport fare</Label>
        <p className="font-medium">{formatMoney(info.fare_amount ?? 0, "GHS")}</p>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Transport status</Label>
        <Badge variant={info.status === "active" ? "success" : "secondary"} className="mt-0.5 capitalize">
          {info.status ?? "inactive"}
        </Badge>
      </div>
      {info.route_name ? (
        <div className="sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Route</Label>
          <p className="font-medium">{info.route_name}</p>
        </div>
      ) : null}
    </div>
  );
}
