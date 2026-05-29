import type { ScheduleEntry, TeacherWorkload } from "@/timetable/lib/types";

const MAX_PERIODS = 25;

export function computeTeacherWorkloads(entries: ScheduleEntry[]): TeacherWorkload[] {
  const map = new Map<string, { name: string; count: number }>();

  for (const e of entries) {
    if (!e.teacher_id) continue;
    const name = e.teachers?.profiles?.full_name ?? "Teacher";
    const cur = map.get(e.teacher_id) ?? { name, count: 0 };
    cur.count += 1;
    map.set(e.teacher_id, cur);
  }

  return [...map.entries()].map(([teacherId, { name, count }]) => {
    const percent = Math.round((count / MAX_PERIODS) * 100);
    let status: TeacherWorkload["status"] = "ok";
    if (percent >= 90) status = "overload";
    else if (percent >= 75) status = "high";
    else if (percent < 40) status = "low";

    return {
      teacherId,
      teacherName: name,
      periodsPerWeek: count,
      maxPeriods: MAX_PERIODS,
      percent,
      status,
    };
  }).sort((a, b) => b.percent - a.percent);
}
