import type { ScheduleEntry, TimetableConflict } from "@/timetable/lib/types";

function timeToMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const a0 = timeToMinutes(aStart);
  const a1 = timeToMinutes(aEnd);
  const b0 = timeToMinutes(bStart);
  const b1 = timeToMinutes(bEnd);
  return a0 < b1 && b0 < a1;
}

export function detectTimetableConflicts(
  entries: ScheduleEntry[],
  allocations: { subject_id: string; class_id: string; periods_per_week: number; subjects?: { name: string } }[] = [],
): TimetableConflict[] {
  const conflicts: TimetableConflict[] = [];
  let cid = 0;

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (a.day_of_week !== b.day_of_week) continue;
      if (!overlaps(a.start_time, a.end_time, b.start_time, b.end_time)) continue;

      if (a.teacher_id && b.teacher_id && a.teacher_id === b.teacher_id) {
        const name = a.teachers?.profiles?.full_name ?? "Teacher";
        conflicts.push({
          id: `c-${++cid}`,
          type: "teacher_overlap",
          severity: "error",
          title: "Teacher double-booking",
          description: `${name} is assigned to two classes at the same time on ${dayName(a.day_of_week)}.`,
          scheduleIds: [a.id, b.id],
        });
      }

      if (a.room && b.room && a.room.trim().toLowerCase() === b.room.trim().toLowerCase()) {
        conflicts.push({
          id: `c-${++cid}`,
          type: "room_overlap",
          severity: "error",
          title: "Room overlap",
          description: `${a.room} is assigned to two classes simultaneously on ${dayName(a.day_of_week)}.`,
          scheduleIds: [a.id, b.id],
        });
      }

      if (a.class_id === b.class_id) {
        conflicts.push({
          id: `c-${++cid}`,
          type: "class_overlap",
          severity: "error",
          title: "Class period clash",
          description: `Class has two subjects scheduled at the same time on ${dayName(a.day_of_week)}.`,
          scheduleIds: [a.id, b.id],
        });
      }
    }
  }

  for (const alloc of allocations) {
    const count = entries.filter(
      (e) => e.class_id === alloc.class_id && e.subject_id === alloc.subject_id,
    ).length;
    if (count > alloc.periods_per_week) {
      const subj = alloc.subjects?.name ?? "Subject";
      conflicts.push({
        id: `c-${++cid}`,
        type: "subject_frequency",
        severity: "warning",
        title: "Subject frequency exceeded",
        description: `${subj} is allocated ${count}× per week when the maximum is ${alloc.periods_per_week}.`,
        scheduleIds: entries
          .filter((e) => e.class_id === alloc.class_id && e.subject_id === alloc.subject_id)
          .map((e) => e.id),
      });
    }
  }

  return conflicts;
}

function dayName(d: number): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d] ?? "Day";
}

export function entryHasConflict(entryId: string, conflicts: TimetableConflict[]): boolean {
  return conflicts.some((c) => c.scheduleIds.includes(entryId));
}
