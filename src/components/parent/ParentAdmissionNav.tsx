import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchParentRecordByUserId,
  fetchStudentsForParent,
  getParentSignupAdmissionNumbers,
  studentDisplayNameForParent,
} from "@/lib/parent-students";
import { toast } from "sonner";

export type ParentAdmissionNavItem = {
  admissionNumber: string;
  studentName?: string;
};

export function useParentAdmissionNavItems(): {
  items: ParentAdmissionNavItem[];
  loading: boolean;
} {
  const { user } = useAuth();
  const [items, setItems] = useState<ParentAdmissionNavItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const parent = await fetchParentRecordByUserId(user.id);
        if (!parent) {
          const signupOnly = getParentSignupAdmissionNumbers(user, null).map((n) => ({
            admissionNumber: n,
          }));
          if (!cancelled) setItems(signupOnly);
          return;
        }

        const students = await fetchStudentsForParent<{
          id: string;
          full_name?: string | null;
          admission_no?: string | null;
          admission_number?: string | null;
          profiles?: { full_name?: string | null } | null;
        }>(parent.id, "id, full_name, admission_no, admission_number, profiles:user_id(full_name)");

        const fromChildren: ParentAdmissionNavItem[] = students
          .map((s) => ({
            admissionNumber: (s.admission_no ?? s.admission_number ?? "").trim().toUpperCase(),
            studentName: studentDisplayNameForParent(s),
          }))
          .filter((x) => x.admissionNumber.length > 0);

        if (fromChildren.length > 0) {
          if (!cancelled) setItems(fromChildren);
          return;
        }

        const signupOnly = getParentSignupAdmissionNumbers(user, parent).map((n) => ({
          admissionNumber: n,
        }));
        if (!cancelled) setItems(signupOnly);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { items, loading };
}

type ParentAdmissionNavProps = {
  variant: "sidebar" | "header";
};

export function ParentAdmissionNav({ variant }: ParentAdmissionNavProps) {
  const { items, loading } = useParentAdmissionNavItems();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(value);
      toast.success("Admission number copied");
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error("Could not copy");
    }
  }, []);

  if (loading || items.length === 0) return null;

  if (variant === "header") {
    const primary = items[0];
    const label =
      items.length > 1
        ? `${primary.admissionNumber} +${items.length - 1}`
        : primary.admissionNumber;

    return (
      <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/30 pl-2.5 pr-0.5 h-9 max-w-[min(100%,220px)]">
        <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0 hidden sm:block" />
        <span className="text-xs font-medium text-muted-foreground hidden sm:inline">Adm.</span>
        <span
          className="text-xs font-mono font-semibold text-foreground px-1 truncate"
          title={items.map((i) => i.admissionNumber).join(", ")}
        >
          {label}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 hover:bg-background/80"
          onClick={() => void handleCopy(primary.admissionNumber)}
          aria-label="Copy admission number"
          title="Copy admission number"
        >
          {copiedKey === primary.admissionNumber ? (
            <Check className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-2 space-y-2 rounded-md border border-sidebar-border bg-sidebar-accent/30 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground/50">
        Child admission {items.length > 1 ? "numbers" : "number"}
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.admissionNumber} className="space-y-0.5">
            {item.studentName && item.studentName !== "Student" ? (
              <p className="text-xs text-sidebar-foreground/70 truncate">{item.studentName}</p>
            ) : null}
            <div className="flex items-center gap-0.5 rounded-md border border-sidebar-border/80 bg-sidebar/50 pl-2 pr-0.5 py-0.5">
              <span className="flex-1 font-mono text-xs text-sidebar-foreground truncate">
                {item.admissionNumber}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 hover:bg-sidebar-accent"
                onClick={() => void handleCopy(item.admissionNumber)}
                aria-label={`Copy ${item.admissionNumber}`}
                title="Copy admission number"
              >
                {copiedKey === item.admissionNumber ? (
                  <Check className="h-3.5 w-3.5 text-[hsl(var(--sidebar-primary))]" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-sidebar-foreground/60" />
                )}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
