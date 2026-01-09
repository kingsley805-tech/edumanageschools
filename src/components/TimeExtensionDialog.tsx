import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, Plus, User, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface TimeExtensionDialogProps {
  examId: string;
  examTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ActiveAttempt {
  id: string;
  started_at: string;
  student: {
    id: string;
    user_id: string;
    profile?: {
      full_name: string;
      email: string;
    };
  };
  extensions: {
    id: string;
    extension_minutes: number;
    reason: string | null;
    created_at: string;
  }[];
}

export function TimeExtensionDialog({ examId, examTitle, open, onOpenChange }: TimeExtensionDialogProps) {
  const [attempts, setAttempts] = useState<ActiveAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAttempt, setSelectedAttempt] = useState<string>("");
  const [extensionMinutes, setExtensionMinutes] = useState(10);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchActiveAttempts();
    }
  }, [open, examId]);

  const fetchActiveAttempts = async () => {
    setLoading(true);
    
    // Get all in-progress attempts for this exam
    const { data: attemptsData, error } = await supabase
      .from("online_exam_attempts")
      .select(`
        id,
        started_at,
        student_id,
        students!inner(id, user_id, profiles:user_id(full_name, email))
      `)
      .eq("online_exam_id", examId)
      .eq("status", "in_progress");

    if (error) {
      console.error("Error fetching attempts:", error);
      setLoading(false);
      return;
    }

    // Get extensions for each attempt
    const attemptsWithExtensions: ActiveAttempt[] = [];
    
    for (const attempt of attemptsData || []) {
      const { data: extensions } = await supabase
        .from("exam_time_extensions")
        .select("id, extension_minutes, reason, created_at")
        .eq("attempt_id", attempt.id)
        .order("created_at", { ascending: false });

      const studentData = attempt.students as any;
      attemptsWithExtensions.push({
        id: attempt.id,
        started_at: attempt.started_at || "",
        student: {
          id: studentData?.id || "",
          user_id: studentData?.user_id || "",
          profile: studentData?.profiles || undefined
        },
        extensions: extensions || []
      });
    }

    setAttempts(attemptsWithExtensions);
    setLoading(false);
  };

  const handleGrantExtension = async () => {
    if (!selectedAttempt) {
      toast.error("Please select a student");
      return;
    }

    if (extensionMinutes <= 0) {
      toast.error("Extension must be greater than 0");
      return;
    }

    setSubmitting(true);

    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from("exam_time_extensions").insert({
      attempt_id: selectedAttempt,
      extension_minutes: extensionMinutes,
      reason: reason || null,
      extended_by: userData.user?.id || ""
    });

    if (error) {
      console.error("Error granting extension:", error);
      toast.error("Failed to grant time extension");
      setSubmitting(false);
      return;
    }

    toast.success(`Added ${extensionMinutes} minutes to student's exam time`);
    setSelectedAttempt("");
    setExtensionMinutes(10);
    setReason("");
    setSubmitting(false);
    fetchActiveAttempts();
  };

  const getTotalExtension = (extensions: { extension_minutes: number }[]) => {
    return extensions.reduce((sum, ext) => sum + ext.extension_minutes, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Extensions - {examTitle}
          </DialogTitle>
          <DialogDescription>
            Grant additional time to students currently taking this exam
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Grant Extension Form */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <h3 className="font-medium mb-4">Grant New Extension</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Select Student</Label>
                <Select value={selectedAttempt} onValueChange={setSelectedAttempt}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {attempts.map((attempt) => (
                      <SelectItem key={attempt.id} value={attempt.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {attempt.student.profile?.full_name || "Unknown Student"}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Extension (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={extensionMinutes}
                  onChange={(e) => setExtensionMinutes(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="mt-4">
              <Label>Reason (optional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Technical difficulties, special accommodations"
                rows={2}
              />
            </div>
            <Button 
              onClick={handleGrantExtension} 
              className="mt-4"
              disabled={!selectedAttempt || submitting}
            >
              <Plus className="h-4 w-4 mr-2" />
              {submitting ? "Granting..." : "Grant Extension"}
            </Button>
          </div>

          {/* Active Students List */}
          <div>
            <h3 className="font-medium mb-2">Students Currently Taking Exam</h3>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : attempts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                <AlertCircle className="h-8 w-8" />
                <p>No students are currently taking this exam</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Started At</TableHead>
                      <TableHead>Extensions</TableHead>
                      <TableHead>Total Extra Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attempts.map((attempt) => (
                      <TableRow key={attempt.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {attempt.student.profile?.full_name || "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {attempt.student.profile?.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {attempt.started_at && format(new Date(attempt.started_at), "PPp")}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {attempt.extensions.length === 0 ? (
                              <span className="text-muted-foreground text-sm">None</span>
                            ) : (
                              attempt.extensions.map((ext) => (
                                <Badge key={ext.id} variant="secondary" className="mr-1">
                                  +{ext.extension_minutes}min
                                  {ext.reason && (
                                    <span className="ml-1 text-xs opacity-70">
                                      ({ext.reason.slice(0, 15)}...)
                                    </span>
                                  )}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getTotalExtension(attempt.extensions) > 0 ? "default" : "outline"}>
                            {getTotalExtension(attempt.extensions)} min
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
