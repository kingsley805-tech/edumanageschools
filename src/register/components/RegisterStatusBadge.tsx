import { Badge } from "@/components/ui/badge";
import type { ClassRegisterStatus } from "@/register/lib/types";

const variants: Record<
  ClassRegisterStatus,
  "success" | "warning" | "destructive" | "secondary"
> = {
  approved: "success",
  submitted: "warning",
  rejected: "destructive",
  draft: "secondary",
};

export function RegisterStatusBadge({ status }: { status: ClassRegisterStatus }) {
  return (
    <Badge variant={variants[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
