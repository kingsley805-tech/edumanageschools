import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAction, saveAction, updateActionStatus } from "@/modules/ai-receptionist/lib/api";
import {
  ACTION_STATUS_LABELS,
  ACTION_TYPE_LABELS,
  type ActionStatus,
  type ActionType,
  type AiAction,
} from "@/modules/ai-receptionist/lib/types";

type Props = {
  actions: AiAction[];
  schoolId: string | null;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onRefresh: () => void;
};

type FormState = {
  action_type: ActionType;
  title: string;
  description: string;
  assigned_department: string;
  due_at: string;
};

const EMPTY_FORM: FormState = {
  action_type: "follow_up",
  title: "",
  description: "",
  assigned_department: "",
  due_at: "",
};

function statusVariant(status: ActionStatus) {
  if (status === "completed") return "default" as const;
  if (status === "cancelled") return "outline" as const;
  if (status === "pending") return "secondary" as const;
  return "secondary" as const;
}

export function AiReceptionistActionsPanel({
  actions,
  schoolId,
  canCreate,
  canEdit,
  canDelete,
  onRefresh,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(
    () => actions.filter((a) => statusFilter === "all" || a.status === statusFilter),
    [actions, statusFilter],
  );

  const handleSave = async () => {
    if (!schoolId) return;
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      await saveAction(schoolId, {
        action_type: form.action_type,
        title: form.title,
        description: form.description,
        assigned_department: form.assigned_department,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      });
      toast.success("Task created");
      setForm(EMPTY_FORM);
      setDialogOpen(false);
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (action: AiAction, status: ActionStatus) => {
    try {
      await updateActionStatus(action.id, status);
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message ?? "Update failed");
    }
  };

  const handleDelete = async (action: AiAction) => {
    try {
      await deleteAction(action.id);
      toast.success("Task removed");
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message ?? "Delete failed");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Follow-up tasks</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Tasks the assistant created from calls, plus any you add manually.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(ACTION_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canCreate ? (
            <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              New task
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No follow-up tasks yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Assigned to</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((action) => (
                  <TableRow key={action.id}>
                    <TableCell>
                      <div className="font-medium">{action.title}</div>
                      {action.description ? (
                        <div className="line-clamp-1 text-xs text-muted-foreground">
                          {action.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ACTION_TYPE_LABELS[action.action_type] ?? action.action_type}
                    </TableCell>
                    <TableCell className="text-sm">{action.assigned_department ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {action.due_at ? new Date(action.due_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(action.status)}>
                        {ACTION_STATUS_LABELS[action.status] ?? action.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {canEdit && action.status !== "completed" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleStatus(action, "completed")}
                          >
                            Complete
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void handleDelete(action)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New follow-up task</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.action_type}
                onValueChange={(v) => setForm((f) => ({ ...f, action_type: v as ActionType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTION_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Call back Mrs. Mensah about absence"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Assign to department</Label>
                <Input
                  value={form.assigned_department}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_department: e.target.value }))}
                  placeholder="e.g. Mathematics"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={form.due_at}
                  onChange={(e) => setForm((f) => ({ ...f, due_at: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving…" : "Create task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
