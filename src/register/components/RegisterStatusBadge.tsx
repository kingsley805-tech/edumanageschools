import { Badge } from "@/components/ui/badge";
import type { ClassRegisterStatus } from "@/register/lib/types";

const styles: Record<ClassRegisterStatus, string> = {
  approved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  submitted: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  rejected: "bg-red-500/15 text-red-600 border-red-500/30",
  draft: "bg-muted text-muted-foreground border-border",
};

export function RegisterStatusBadge({ status }: { status: ClassRegisterStatus }) {
  return (
    <Badge variant="outline" className={styles[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
