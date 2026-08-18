import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Search,
  PhoneIncoming,
  PhoneOutgoing,
  ShieldCheck,
  AlertTriangle,
  Wrench,
  Bot,
  User,
  CheckCircle2,
  Clock,
  Music,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchCallConversationLogs,
  fetchCallTranscript,
  updateCallFollowUp,
} from "@/modules/ai-receptionist/lib/api";
import {
  CALL_STATUS_LABELS,
  formatCallDuration,
  type AiCall,
  type AiCallTranscript,
  type AiConversationLog,
  type CallStatus,
} from "@/modules/ai-receptionist/lib/types";

type Props = {
  calls: AiCall[];
  canEdit: boolean;
  onRefresh: () => void;
  onOpenOutboundModal?: () => void;
};

const SPEAKER_ICONS: Record<AiCallTranscript["speaker"], typeof Bot> = {
  ai: Bot,
  caller: User,
  staff: User,
  system: Wrench,
};

function statusVariant(status: CallStatus) {
  if (status === "escalated" || status === "failed") return "destructive" as const;
  if (status === "completed") return "default" as const;
  if (status === "in_progress" || status === "ringing") return "outline" as const;
  return "secondary" as const;
}

export function AiReceptionistCallsPanel({ calls, canEdit, onRefresh, onOpenOutboundModal }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [selected, setSelected] = useState<AiCall | null>(null);
  const [transcript, setTranscript] = useState<AiCallTranscript[]>([]);
  const [logs, setLogs] = useState<AiConversationLog[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<"transcript" | "tools">("transcript");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return calls.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (directionFilter !== "all" && c.direction !== directionFilter) return false;
      if (!term) return true;
      return [c.caller_name, c.caller_phone, c.summary, c.detected_intent, c.student_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [calls, search, statusFilter, directionFilter]);

  useEffect(() => {
    if (!selected) {
      setTranscript([]);
      setLogs([]);
      return;
    }
    let cancelled = false;
    setLoadingDetails(true);

    Promise.all([
      fetchCallTranscript(selected.id).catch(() => []),
      fetchCallConversationLogs(selected.id).catch(() => []),
    ])
      .then(([tRows, lRows]) => {
        if (!cancelled) {
          setTranscript(tRows);
          setLogs(lRows);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  const handleFollowUp = async (call: AiCall, status: string) => {
    try {
      await updateCallFollowUp(call.id, status);
      toast.success("Follow-up status updated");
      onRefresh();
      if (selected && selected.id === call.id) {
        setSelected({ ...selected, follow_up_status: status });
      }
    } catch (e) {
      toast.error((e as Error).message ?? "Update failed");
    }
  };

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Voice Call Logs & Transcripts</CardTitle>
          <CardDescription className="text-xs">
            Complete history of inbound parent inquiries and automated outbound notifications
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenOutboundModal ? (
            <Button size="sm" onClick={onOpenOutboundModal} className="gap-1.5 h-8 text-xs">
              <PhoneOutgoing className="h-3.5 w-3.5" />
              New Outbound Call
            </Button>
          ) : null}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search phone, student, summary…"
              className="w-full pl-8 sm:w-56 h-8 text-xs"
            />
          </div>
          <Select value={directionFilter} onValueChange={setDirectionFilter}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Directions</SelectItem>
              <SelectItem value="inbound">Inbound</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(CALL_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium">No calls match your filters.</p>
            <p className="text-xs text-muted-foreground mt-0.5">Calls will appear here in real time as they connect.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="text-xs">Caller / Phone</TableHead>
                  <TableHead className="text-xs">Student Linked</TableHead>
                  <TableHead className="text-xs">Date & Time</TableHead>
                  <TableHead className="text-xs">Duration</TableHead>
                  <TableHead className="text-xs">Intent / Purpose</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-right text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((call) => (
                  <TableRow key={call.id} className="hover:bg-muted/30">
                    <TableCell>
                      {call.direction === "inbound" ? (
                        <PhoneIncoming className="h-4 w-4 text-emerald-600" title="Inbound call" />
                      ) : (
                        <PhoneOutgoing className="h-4 w-4 text-blue-600" title="Outbound call" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-medium text-xs">
                        <span>{call.caller_name || "Parent / Caller"}</span>
                        {call.is_verified ? (
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" title="Verified Parent" />
                        ) : null}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{call.caller_phone || "—"}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {call.student_name ? (
                        <span className="font-medium text-primary">{call.student_name}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(call.started_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {formatCallDuration(call.duration_seconds)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {call.detected_intent ? (
                        <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0">
                          {call.detected_intent.replace(/_/g, " ")}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(call.status)} className="text-[10px] px-1.5 py-0">
                        {CALL_STATUS_LABELS[call.status] ?? call.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => setSelected(call)} className="h-7 text-xs px-2.5">
                          <FileText className="mr-1 h-3 w-3" />
                          Details
                        </Button>
                        {canEdit && call.follow_up_status === "pending" ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleFollowUp(call, "resolved")}
                            className="h-7 text-xs px-2"
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" />
                            Resolve
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

      {/* =================================================================== */}
      {/* Call Details Modal                                                  */}
      {/* =================================================================== */}
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold">
                  {selected?.caller_name || selected?.caller_phone || "Call Details"}
                </DialogTitle>
                {selected?.is_verified ? (
                  <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-[10px]">
                    <ShieldCheck className="h-3 w-3 mr-1" /> Verified
                  </Badge>
                ) : null}
                <Badge variant={selected ? statusVariant(selected.status) : "secondary"} className="text-[10px]">
                  {selected ? CALL_STATUS_LABELS[selected.status] || selected.status : ""}
                </Badge>
              </div>
            </div>
            <DialogDescription className="text-xs">
              {selected ? new Date(selected.started_at).toLocaleString() : ""} ·{" "}
              Duration: {selected ? formatCallDuration(selected.duration_seconds) : "0:00"} ·{" "}
              Direction: {selected?.direction === "inbound" ? "Inbound" : "Outbound"}
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="space-y-4 overflow-y-auto pr-1">
              {/* Escalation Alert */}
              {selected.escalated || selected.status === "escalated" ? (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2.5 text-xs text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Call Escalated to Human Staff:</span>{" "}
                    {selected.escalation_reason || "Caller requested escalation"}
                  </div>
                </div>
              ) : null}

              {/* Call Summary Card */}
              {selected.summary ? (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold text-primary">
                    <Bot className="h-3.5 w-3.5" />
                    <span>AI Call Summary</span>
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed">{selected.summary}</p>
                </div>
              ) : null}

              {/* Audio Player if recording URL exists */}
              {selected.recording_url ? (
                <div className="rounded-lg border bg-background p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Music className="h-3.5 w-3.5" />
                    <span>Dual-Channel Audio Recording</span>
                  </div>
                  <audio controls className="w-full h-8" src={selected.recording_url}>
                    Your browser does not support audio playback.
                  </audio>
                </div>
              ) : null}

              {/* Tabs: Transcript vs Tool Invocations */}
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("transcript")}
                      className={`text-xs font-medium pb-1 border-b-2 transition-colors ${
                        activeTab === "transcript"
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Conversation Transcript ({transcript.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("tools")}
                      className={`text-xs font-medium pb-1 border-b-2 transition-colors ${
                        activeTab === "tools"
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Executed Tools & Actions ({logs.length})
                    </button>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    SID: {selected.provider_call_sid || "—"}
                  </span>
                </div>

                {activeTab === "transcript" ? (
                  <ScrollArea className="h-64 rounded-lg border bg-muted/10 p-3">
                    {loadingDetails ? (
                      <p className="text-xs text-muted-foreground text-center py-8">Loading transcript…</p>
                    ) : transcript.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        No spoken transcript records stored for this call.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {transcript.map((line) => {
                          const isAi = line.speaker === "ai";
                          const Icon = SPEAKER_ICONS[line.speaker] || Bot;
                          return (
                            <div
                              key={line.id}
                              className={`flex gap-2.5 text-xs ${isAi ? "justify-start" : "justify-end"}`}
                            >
                              {isAi ? (
                                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                                  <Icon className="h-3.5 w-3.5" />
                                </div>
                              ) : null}
                              <div
                                className={`rounded-xl px-3 py-2 max-w-[80%] ${
                                  isAi
                                    ? "bg-card border text-card-foreground"
                                    : "bg-primary text-primary-foreground"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-4 mb-0.5 text-[10px] opacity-75">
                                  <span>{isAi ? "AI Receptionist" : selected.caller_name || "Caller"}</span>
                                  <span>
                                    {new Date(line.spoken_at).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                    })}
                                  </span>
                                </div>
                                <p className="text-xs leading-relaxed">{line.content}</p>
                              </div>
                              {!isAi ? (
                                <div className="h-6 w-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">
                                  <Icon className="h-3.5 w-3.5" />
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                ) : (
                  <ScrollArea className="h-64 rounded-lg border bg-muted/10 p-3">
                    {logs.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        No automated backend tools were triggered during this call.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {logs.map((log) => (
                          <div key={log.id} className="rounded-lg border bg-card p-2.5 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 font-semibold text-primary">
                                <Wrench className="h-3.5 w-3.5" />
                                <span>Tool: {String(log.payload?.tool || log.event_type)}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(log.created_at).toLocaleTimeString()}
                              </span>
                            </div>
                            {log.payload?.arguments ? (
                              <pre className="rounded bg-muted/50 p-1.5 text-[10px] font-mono overflow-x-auto">
                                {JSON.stringify(log.payload.arguments, null, 2)}
                              </pre>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
