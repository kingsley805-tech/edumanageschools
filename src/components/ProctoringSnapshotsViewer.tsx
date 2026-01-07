import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, AlertTriangle, User, ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Student {
  id: string;
  user_id: string;
  profiles: { full_name: string } | null;
}

interface ProctoringLog {
  id: string;
  violation_type: string;
  description: string | null;
  snapshot_url: string | null;
  created_at: string;
}

interface ProctoringSnapshotsViewerProps {
  examId: string;
  examTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProctoringSnapshotsViewer = ({
  examId,
  examTitle,
  open,
  onOpenChange,
}: ProctoringSnapshotsViewerProps) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [logs, setLogs] = useState<ProctoringLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (open) {
      fetchStudentsWithLogs();
    }
  }, [open, examId]);

  useEffect(() => {
    if (selectedStudent) {
      fetchStudentLogs(selectedStudent);
    }
  }, [selectedStudent]);

  const fetchStudentsWithLogs = async () => {
    setLoading(true);
    
    // Get all attempts for this exam
    const { data: attempts } = await supabase
      .from("online_exam_attempts")
      .select("id, student_id")
      .eq("online_exam_id", examId);

    if (!attempts || attempts.length === 0) {
      setLoading(false);
      return;
    }

    const studentIds = [...new Set(attempts.map(a => a.student_id).filter(Boolean))] as string[];

    // Get student info
    const { data: studentsData } = await supabase
      .from("students")
      .select("id, user_id, profiles:user_id(full_name)")
      .in("id", studentIds);

    if (studentsData) {
      setStudents(studentsData as Student[]);
      if (studentsData.length > 0 && !selectedStudent) {
        setSelectedStudent(studentsData[0].id);
      }
    }
    setLoading(false);
  };

  const fetchStudentLogs = async (studentId: string) => {
    // Get attempt for this student and exam
    const { data: attempt } = await supabase
      .from("online_exam_attempts")
      .select("id")
      .eq("online_exam_id", examId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (!attempt) {
      setLogs([]);
      return;
    }

    const { data: logsData } = await supabase
      .from("exam_proctoring_logs")
      .select("*")
      .eq("attempt_id", attempt.id)
      .order("created_at", { ascending: true });

    if (logsData) {
      setLogs(logsData);
    }
  };

  const getSnapshotUrl = (path: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from("proctoring-snapshots").getPublicUrl(path);
    return data.publicUrl;
  };

  const snapshotsWithImages = logs.filter(l => l.snapshot_url);
  const violations = logs.filter(l => !["periodic_snapshot", "face_detected", "exam_start", "exam_end"].includes(l.violation_type));

  const getViolationColor = (type: string) => {
    switch (type) {
      case "tab_switch":
        return "bg-yellow-500";
      case "fullscreen_exit":
        return "bg-orange-500";
      case "no_face_detected":
      case "multiple_faces_detected":
        return "bg-red-500";
      case "copy_attempt":
      case "right_click":
        return "bg-purple-500";
      default:
        return "bg-blue-500";
    }
  };

  const openLightbox = (index: number) => {
    setCurrentImageIndex(index);
    setLightboxImage(getSnapshotUrl(snapshotsWithImages[index]?.snapshot_url));
  };

  const navigateLightbox = (direction: "prev" | "next") => {
    let newIndex = direction === "prev" ? currentImageIndex - 1 : currentImageIndex + 1;
    if (newIndex < 0) newIndex = snapshotsWithImages.length - 1;
    if (newIndex >= snapshotsWithImages.length) newIndex = 0;
    setCurrentImageIndex(newIndex);
    setLightboxImage(getSnapshotUrl(snapshotsWithImages[newIndex]?.snapshot_url));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Proctoring Snapshots - {examTitle}
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-4 flex-1 min-h-0">
            {/* Student Selector */}
            <div className="w-64 flex-shrink-0">
              <Select value={selectedStudent || ""} onValueChange={setSelectedStudent}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {s.profiles?.full_name || "Unknown Student"}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedStudent && (
                <div className="mt-4 space-y-2">
                  <div className="text-sm font-medium">Summary</div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Total Snapshots: {snapshotsWithImages.length}</p>
                    <p>Violations: {violations.length}</p>
                  </div>
                  
                  {violations.length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm font-medium mb-2">Violations</div>
                      <ScrollArea className="h-48">
                        <div className="space-y-2">
                          {violations.map((v) => (
                            <div key={v.id} className="text-xs p-2 bg-muted rounded">
                              <Badge variant="destructive" className="text-xs mb-1">
                                {v.violation_type.replace(/_/g, " ")}
                              </Badge>
                              <p className="text-muted-foreground">{v.description}</p>
                              <p className="text-muted-foreground mt-1">
                                {format(new Date(v.created_at), "HH:mm:ss")}
                              </p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Snapshots Grid */}
            <div className="flex-1 min-h-0">
              <Tabs defaultValue="grid">
                <TabsList>
                  <TabsTrigger value="grid">Grid View</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                </TabsList>
                
                <TabsContent value="grid" className="mt-4">
                  <ScrollArea className="h-[500px]">
                    {snapshotsWithImages.length > 0 ? (
                      <div className="grid grid-cols-3 gap-3">
                        {snapshotsWithImages.map((log, index) => (
                          <Card 
                            key={log.id} 
                            className="cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                            onClick={() => openLightbox(index)}
                          >
                            <CardContent className="p-2">
                              <div className="relative aspect-video bg-muted rounded overflow-hidden">
                                <img
                                  src={getSnapshotUrl(log.snapshot_url) || ""}
                                  alt="Proctoring snapshot"
                                  className="w-full h-full object-cover"
                                />
                                {!["periodic_snapshot", "face_detected", "exam_start", "exam_end"].includes(log.violation_type) && (
                                  <div className="absolute top-1 right-1">
                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                  </div>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1">
                                  {format(new Date(log.created_at), "HH:mm:ss")}
                                </div>
                              </div>
                              <div className="mt-1">
                                <Badge 
                                  variant="secondary" 
                                  className={`text-xs ${getViolationColor(log.violation_type)} text-white`}
                                >
                                  {log.violation_type.replace(/_/g, " ")}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                        <Camera className="h-12 w-12 mb-4" />
                        <p>No snapshots available for this student</p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="timeline" className="mt-4">
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-3">
                      {logs.map((log) => (
                        <div key={log.id} className="flex gap-3 p-3 border rounded-lg">
                          <div className="text-xs text-muted-foreground w-16 flex-shrink-0">
                            {format(new Date(log.created_at), "HH:mm:ss")}
                          </div>
                          <div className="flex-1">
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${getViolationColor(log.violation_type)} text-white`}
                            >
                              {log.violation_type.replace(/_/g, " ")}
                            </Badge>
                            <p className="text-sm text-muted-foreground mt-1">{log.description}</p>
                          </div>
                          {log.snapshot_url && (
                            <div 
                              className="w-20 h-14 bg-muted rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary"
                              onClick={() => {
                                const index = snapshotsWithImages.findIndex(s => s.id === log.id);
                                if (index !== -1) openLightbox(index);
                              }}
                            >
                              <img
                                src={getSnapshotUrl(log.snapshot_url) || ""}
                                alt="Snapshot"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                      {logs.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                          <p>No proctoring logs for this student</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setLightboxImage(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
            onClick={() => navigateLightbox("prev")}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>

          <div className="max-w-4xl max-h-[80vh]">
            <img
              src={lightboxImage}
              alt="Snapshot"
              className="max-w-full max-h-[80vh] object-contain"
            />
            <div className="text-center text-white mt-4">
              <p className="text-sm">
                {snapshotsWithImages[currentImageIndex]?.violation_type.replace(/_/g, " ")} - 
                {format(new Date(snapshotsWithImages[currentImageIndex]?.created_at), " PPpp")}
              </p>
              <p className="text-xs text-white/70 mt-1">
                {currentImageIndex + 1} of {snapshotsWithImages.length}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
            onClick={() => navigateLightbox("next")}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </div>
      )}
    </>
  );
};
