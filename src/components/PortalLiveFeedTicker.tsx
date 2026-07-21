import { useCallback, useEffect, useMemo, useState } from "react";
import { MINGO } from "@/lib/designTokens";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useSchoolCurrency } from "@/hooks/useSchoolCurrency";
import { formatDistanceToNowStrict } from "date-fns";

export type LiveFeedEvent = {
  id: string;
  tag: "att" | "fee" | "exm" | "hr" | "alt" | "sys";
  label: string;
  text: string;
  qty: string;
  loc: string;
  at: number;
};

type Props = {
  /** Optional override; when omitted, loads live school activity */
  events?: LiveFeedEvent[];
};

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

/** mingo LIVE FEED ticker — real school activity */
export function PortalLiveFeedTicker({ events: eventsProp }: Props) {
  const { currentSchool } = useSchoolInfo();
  const { currency, format } = useSchoolCurrency();
  const [liveEvents, setLiveEvents] = useState<LiveFeedEvent[]>([]);

  const load = useCallback(async () => {
    const schoolId = currentSchool?.id;
    if (!schoolId) {
      setLiveEvents([]);
      return;
    }

    const soft = <T,>(p: PromiseLike<{ data: T | null; error: unknown }>) =>
      Promise.resolve(p).then(
        (r) => (r.error ? null : r.data),
        () => null,
      );

    const [
      attendanceRows,
      paymentRows,
      invoiceRows,
      announcementRows,
      approvalRows,
    ] = await Promise.all([
      soft(
        supabase
          .from("attendance_records")
          .select(
            "id, attendance_date, attendance_status, created_at, classes(name), teachers(profiles(full_name))",
          )
          .eq("school_id", schoolId)
          .order("created_at", { ascending: false })
          .limit(80),
      ),
      soft(
        supabase
          .from("billing_payments")
          .select(
            "id, amount, currency, paid_at, created_at, payer_name, students(full_name, profiles:profile_id(full_name), classes(name))",
          )
          .eq("school_id", schoolId)
          .order("created_at", { ascending: false })
          .limit(12),
      ),
      soft(
        supabase
          .from("invoices")
          .select(
            "id, amount, status, updated_at, created_at, students!inner(school_id, full_name, profiles:profile_id(full_name), classes(name))",
          )
          .eq("students.school_id", schoolId)
          .in("status", ["unpaid", "overdue", "pending", "partial"])
          .order("updated_at", { ascending: false })
          .limit(8),
      ),
      soft(
        supabase
          .from("announcements")
          .select("id, title, created_at, priority")
          .eq("school_id", schoolId)
          .order("created_at", { ascending: false })
          .limit(6),
      ),
      soft(
        supabase
          .from("approval_requests")
          .select("id, module, request_type, status, created_at, reviewed_at")
          .eq("school_id", schoolId)
          .order("created_at", { ascending: false })
          .limit(6),
      ),
    ]);

    const items: LiveFeedEvent[] = [];

    // Aggregate attendance by class + date
    type AttAgg = {
      className: string;
      teacher: string;
      present: number;
      total: number;
      at: string;
      key: string;
    };
    const attMap = new Map<string, AttAgg>();
    for (const row of attendanceRows ?? []) {
      const className =
        (row.classes as { name?: string } | null)?.name || "Class";
      const teacher =
        (
          row.teachers as {
            profiles?: { full_name?: string } | null;
          } | null
        )?.profiles?.full_name || "Staff";
      const key = `${row.attendance_date}|${className}`;
      const existing = attMap.get(key);
      const status = String(row.attendance_status || "").toLowerCase();
      const isPresent =
        status === "present" || status === "late" || status === "excused";
      if (!existing) {
        attMap.set(key, {
          className,
          teacher,
          present: isPresent ? 1 : 0,
          total: 1,
          at: row.created_at || row.attendance_date,
          key,
        });
      } else {
        existing.total += 1;
        if (isPresent) existing.present += 1;
        const t = row.created_at || row.attendance_date;
        if (t > existing.at) existing.at = t;
      }
    }
    for (const a of [...attMap.values()]
      .sort((x, y) => (x.at < y.at ? 1 : -1))
      .slice(0, 6)) {
      items.push({
        id: `att-${a.key}`,
        tag: "att",
        label: "ATT",
        text: `Attendance marked, ${a.className}`,
        qty: `${a.present}/${a.total} present`,
        loc: a.teacher,
        at: new Date(a.at).getTime(),
      });
    }

    for (const p of paymentRows ?? []) {
      const student = p.students as {
        full_name?: string;
        profiles?: { full_name?: string };
        classes?: { name?: string };
      } | null;
      const name =
        student?.full_name ||
        student?.profiles?.full_name ||
        p.payer_name ||
        "Payer";
      const amt = format(Number(p.amount) || 0, p.currency || currency);
      const when = p.paid_at || p.created_at;
      items.push({
        id: `fee-${p.id}`,
        tag: "fee",
        label: "FEE",
        text: "Fee payment received",
        qty: `+${amt}`,
        loc:
          [name, student?.classes?.name].filter(Boolean).join(" · ") ||
          timeAgo(when),
        at: new Date(when).getTime(),
      });
    }

    for (const inv of invoiceRows ?? []) {
      const s = inv.students as {
        full_name?: string;
        profiles?: { full_name?: string };
        classes?: { name?: string };
      } | null;
      const name = s?.full_name || s?.profiles?.full_name || "Student";
      const when = inv.updated_at || inv.created_at;
      items.push({
        id: `alt-${inv.id}`,
        tag: "alt",
        label: "ALT",
        text: `Fee ${String(inv.status || "overdue")}, ${name}`,
        qty: format(Number(inv.amount) || 0, currency),
        loc: s?.classes?.name || timeAgo(when),
        at: new Date(when).getTime(),
      });
    }

    for (const a of announcementRows ?? []) {
      items.push({
        id: `sys-${a.id}`,
        tag: "sys",
        label: "SYS",
        text: a.title || "Announcement posted",
        qty: a.priority ? String(a.priority) : "Notice",
        loc: timeAgo(a.created_at) || "School",
        at: new Date(a.created_at || Date.now()).getTime(),
      });
    }

    for (const r of approvalRows ?? []) {
      const status = String(r.status || "").toLowerCase();
      const done = status === "approved" || status === "rejected";
      items.push({
        id: `hr-${r.id}`,
        tag: "hr",
        label: "HR",
        text: `${String(r.module || "Request").replace(/_/g, " ")} — ${String(r.request_type || "review").replace(/_/g, " ")}`,
        qty: status || "pending",
        loc: timeAgo(done ? r.reviewed_at : r.created_at) || "Approvals",
        at: new Date((done ? r.reviewed_at : r.created_at) || Date.now()).getTime(),
      });
    }

    items.sort((a, b) => b.at - a.at);
    setLiveEvents(items.slice(0, 16));
  }, [currentSchool?.id, currency, format]);

  useEffect(() => {
    if (eventsProp?.length) return;
    void load();
  }, [load, eventsProp]);

  useEffect(() => {
    if (eventsProp?.length || !currentSchool?.id) return;

    const schoolId = currentSchool.id;
    const channel = supabase
      .channel(`live-feed:${schoolId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "billing_payments",
          filter: `school_id=eq.${schoolId}`,
        },
        () => {
          void load();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_records",
          filter: `school_id=eq.${schoolId}`,
        },
        () => {
          void load();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "announcements",
          filter: `school_id=eq.${schoolId}`,
        },
        () => {
          void load();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "approval_requests",
          filter: `school_id=eq.${schoolId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();

    const poll = window.setInterval(() => {
      void load();
    }, 60_000);

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [currentSchool?.id, eventsProp, load]);

  const list = useMemo(() => {
    if (eventsProp?.length) return eventsProp;
    if (liveEvents.length) return liveEvents;
    return [
      {
        id: "empty",
        tag: "sys" as const,
        label: "SYS",
        text: "Waiting for school activity",
        qty: "—",
        loc: currentSchool?.school_name || "School Hub",
        at: Date.now(),
      },
    ];
  }, [eventsProp, liveEvents, currentSchool?.school_name]);

  // Duplicate for seamless marquee; pad short feeds so the track can roam
  const doubled = useMemo(() => {
    const base =
      list.length >= 4
        ? list
        : [...list, ...list, ...list, ...list].slice(0, 8);
    return [...base, ...base];
  }, [list]);

  return (
    <div
      className="portal-ticker-wrap flex h-[34px] min-w-0 shrink-0 items-center overflow-hidden whitespace-nowrap border-b border-black"
      style={{ background: MINGO.lineStrong }}
      aria-live="polite"
    >
      <div className="portal-ticker-label z-[2] flex h-full shrink-0 items-center bg-white px-3 font-mono text-[10.5px] font-semibold tracking-[0.06em] text-[hsl(var(--foreground))]">
        LIVE FEED
      </div>
      <div className="portal-ticker-track">
        {doubled.map((e, i) => (
          <div
            key={`${e.id}-${i}`}
            className="portal-tick flex shrink-0 items-center gap-2 border-r border-[#333336] px-[22px] font-mono text-[11.5px] text-[#d4d4d8]"
          >
            <span className={`portal-tick-tag tag-${e.tag}`}>{e.label}</span>
            <span>{e.text}</span>
            <span className="text-white">{e.qty}</span>
            <span style={{ color: MINGO.sidebarMutedText }}>{e.loc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
