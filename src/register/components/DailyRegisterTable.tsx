// @ts-nocheck
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, UserCheck } from "lucide-react";
import type { AttendanceStatusType } from "@/register/lib/types";
import { AttendanceStatusBadge } from "@/register/components/AttendanceStatusBadge";

export type RegisterLine = {
  attendance_status: string;
  time_in: string;
  participation: string;
  remarks: string;
};

export type RegisterStudent = {
  id: string;
  admission_no?: string | null;
  gender?: string | null;
  profiles?: { full_name?: string } | null;
};

type Props = {
  className?: string;
  subjectName?: string;
  periodLabel?: string;
  registerDate: string;
  students: RegisterStudent[];
  lines: Record<string, RegisterLine>;
  statusTypes: AttendanceStatusType[];
  readOnly?: boolean;
  onChange: (studentId: string, patch: Partial<RegisterLine>) => void;
  onMarkAllPresent?: () => void;
};

function formatHeaderDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatTimeDisplay(time: string) {
  if (!time) return "--";
  const [h, m] = time.split(":");
  const hour = parseInt(h ?? "0", 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m ?? "00"}${ampm}`;
}

export function DailyRegisterTable({
  className: classLabel,
  subjectName,
  periodLabel,
  registerDate,
  students,
  lines,
  statusTypes,
  readOnly,
  onChange,
  onMarkAllPresent,
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.profiles?.full_name?.toLowerCase().includes(q) ||
        s.admission_no?.toLowerCase().includes(q),
    );
  }, [students, search]);

  const totals = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    for (const s of students) {
      const code = (lines[s.id]?.attendance_status ?? "present").toLowerCase();
      if (code === "present") present++;
      else if (code === "late") late++;
      else if (["absent", "sick", "excused", "suspended"].includes(code)) absent++;
    }
    return { present, absent, late, total: students.length };
  }, [students, lines]);

  const dateLabel = formatHeaderDate(registerDate);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="bg-muted/50 border-b px-4 py-3 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Daily class register
        </p>
        <p className="text-sm font-bold">
          {[classLabel, subjectName, dateLabel, periodLabel].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search student…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {!readOnly && onMarkAllPresent ? (
          <Button type="button" variant="outline" size="sm" onClick={onMarkAllPresent}>
            <UserCheck className="h-4 w-4 mr-1" />
            Mark all present
          </Button>
        ) : null}
      </div>

      <div className="max-h-[min(70vh,640px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow>
              <TableHead className="w-10 bg-muted">#</TableHead>
              <TableHead className="bg-muted min-w-[160px]">Student name</TableHead>
              <TableHead className="bg-muted">Admission no</TableHead>
              <TableHead className="bg-muted w-20">Gender</TableHead>
              <TableHead className="bg-muted min-w-[140px]">Attendance</TableHead>
              <TableHead className="bg-muted w-28">Time in</TableHead>
              <TableHead className="bg-muted min-w-[120px]">Remark</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  {students.length === 0 ? "Select a class to load students." : "No students match your search."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s, i) => {
                const row = lines[s.id] ?? {
                  attendance_status: "present",
                  time_in: "",
                  participation: "",
                  remarks: "",
                };
                return (
                  <TableRow key={s.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">{s.profiles?.full_name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{s.admission_no ?? "—"}</TableCell>
                    <TableCell className="capitalize text-sm">{s.gender ?? "—"}</TableCell>
                    <TableCell>
                      {readOnly ? (
                        <AttendanceStatusBadge code={row.attendance_status} statuses={statusTypes} />
                      ) : (
                        <Select
                          value={row.attendance_status}
                          onValueChange={(v) => onChange(s.id, { attendance_status: v })}
                        >
                          <SelectTrigger className="w-[140px] h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusTypes.map((st) => (
                              <SelectItem key={st.code} value={st.code}>
                                <span className="flex items-center gap-2">
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: st.color }}
                                  />
                                  {st.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {readOnly ? (
                        <span className="text-sm">{formatTimeDisplay(row.time_in)}</span>
                      ) : (
                        <Input
                          type="time"
                          className="w-[120px] h-9"
                          value={row.time_in}
                          onChange={(ev) => onChange(s.id, { time_in: ev.target.value })}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {readOnly ? (
                        <span className="text-sm">{row.remarks || "—"}</span>
                      ) : (
                        <Input
                          className="h-9"
                          placeholder="Remark"
                          value={row.remarks}
                          onChange={(ev) => onChange(s.id, { remarks: ev.target.value })}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="border-t bg-muted/30 px-4 py-3 text-sm">
        <p className="font-medium">Total students: {totals.total}</p>
        <p className="text-muted-foreground mt-1">
          Present: <span className="text-green-600 font-semibold">{totals.present}</span>
          {" · "}
          Absent: <span className="text-red-600 font-semibold">{totals.absent}</span>
          {" · "}
          Late: <span className="text-orange-600 font-semibold">{totals.late}</span>
        </p>
      </div>
    </div>
  );
}
