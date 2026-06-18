import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, FileText, Loader2, Plus, Video } from "lucide-react";
import { toast } from "sonner";
import {
  addLiveClassResource,
  addSessionRecording,
  fetchLiveClassResources,
  fetchSessionRecordings,
} from "@/live-classes/lib/api";
import type { LiveClassRecording, LiveClassResource } from "@/live-classes/lib/types";

type Props = {
  liveClassId: string;
  sessionId: string;
  schoolId: string;
  canManage?: boolean;
  userId?: string;
};

export function LiveClassResourcesPanel({
  liveClassId,
  sessionId,
  schoolId,
  canManage,
  userId,
}: Props) {
  const [resources, setResources] = useState<LiveClassResource[]>([]);
  const [recordings, setRecordings] = useState<LiveClassRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceType, setResourceType] = useState("pdf");
  const [recordingUrl, setRecordingUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [res, rec] = await Promise.all([
        fetchLiveClassResources(liveClassId),
        fetchSessionRecordings(sessionId),
      ]);
      setResources(res);
      setRecordings(rec);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [liveClassId, sessionId]);

  const handleAddResource = async () => {
    if (!resourceTitle.trim() || !userId) return;
    setSaving(true);
    try {
      await addLiveClassResource({
        liveClassId,
        schoolId,
        title: resourceTitle.trim(),
        resourceType,
        fileUrl: resourceUrl.trim() || undefined,
        uploadedBy: userId,
      });
      toast.success("Resource added");
      setResourceTitle("");
      setResourceUrl("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add resource");
    } finally {
      setSaving(false);
    }
  };

  const handleAddRecording = async () => {
    if (!recordingUrl.trim()) return;
    setSaving(true);
    try {
      await addSessionRecording({
        sessionId,
        schoolId,
        recordingUrl: recordingUrl.trim(),
        title: "Class recording",
      });
      toast.success("Recording link saved");
      setRecordingUrl("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save recording");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading resources…</p>;
  }

  return (
    <div className="space-y-4">
      {resources.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Learning resources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resources.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm border rounded-lg p-2">
                <div>
                  <p className="font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground capitalize">{r.resource_type}</p>
                </div>
                {r.file_url ? (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={r.file_url} target="_blank" rel="noopener noreferrer">
                      Open <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {recordings.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Video className="h-4 w-4" />
              Recordings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recordings.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm border rounded-lg p-2">
                <div>
                  <p className="font-medium">{r.title ?? "Class recording"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.recording_date).toLocaleDateString()}
                    {r.duration_seconds ? ` · ${Math.round(r.duration_seconds / 60)} min` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <a href={r.recording_url} target="_blank" rel="noopener noreferrer">
                    Replay <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {canManage && (
        <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Add material</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input value={resourceTitle} onChange={(e) => setResourceTitle(e.target.value)} placeholder="Worksheet" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={resourceType} onValueChange={setResourceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="notes">Notes</SelectItem>
                  <SelectItem value="ppt">PowerPoint</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="assignment">Assignment</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">File URL</Label>
            <Input value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} placeholder="https://…" />
          </div>
          <Button size="sm" onClick={handleAddResource} disabled={saving || !resourceTitle.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Add resource
          </Button>

          <div className="space-y-1 pt-2 border-t">
            <Label className="text-xs">Recording link</Label>
            <div className="flex gap-2">
              <Input value={recordingUrl} onChange={(e) => setRecordingUrl(e.target.value)} placeholder="Google Drive / Meet recording URL" />
              <Button size="sm" variant="secondary" onClick={handleAddRecording} disabled={saving || !recordingUrl.trim()}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {!canManage && resources.length === 0 && recordings.length === 0 && (
        <p className="text-sm text-muted-foreground">No resources or recordings yet.</p>
      )}
    </div>
  );
}
