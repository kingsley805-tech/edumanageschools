import type { AttendanceStatusType } from "@/register/lib/types";
import { cn } from "@/lib/utils";

export function AttendanceStatusBadge({
  code,
  label,
  color,
  statuses,
}: {
  code: string;
  label?: string;
  color?: string;
  statuses?: AttendanceStatusType[];
}) {
  const match = statuses?.find((s) => s.code === code);
  const display = label ?? match?.label ?? code;
  const bg = color ?? match?.color ?? "#6b7280";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
      )}
      style={{
        backgroundColor: `${bg}22`,
        color: bg,
        border: `1px solid ${bg}55`,
      }}
    >
      {display}
    </span>
  );
}
