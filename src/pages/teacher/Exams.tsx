import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { ClipboardList, Plus, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ExamForm {
  title: string;
  description: string;
  subject_id: string;
  class_id: string;
  exam_date: string;
  duration_minutes: number;
  total_marks: number;
  term: string;
}

const Exams = () => {
  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [results, setResults] = useState<Record<string, { marks: string; grade: string }>>({});

  const { register, handleSubmit, reset, setValue } = useForm<ExamForm>();

  useEffect(() => {
    fetchExams();
    fetchClasses();
    fetchSubjects();
  }, []);

  const fetchExams = async () => {
    const { data } = await supabase
      .from("exams")
      .select(`
        *,
        subject:subjects(name),
        class:classes(name)
      `)
      .order("exam_date", { ascending: false });

    setExams(data || []);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from("classes").select("*");
    setClasses(data || []);
  };

  const fetchSubjects = async () => {
    const { data } = await supabase.from("subjects").select("*");
    setSubjects(data || []);
  };

  const onSubmit = async (data: ExamForm) => {
    const { error } = await supabase.from("exams").insert({
      ...data,
      duration_minutes: Number(data.duration_minutes),
      total_marks: Number(data.total_marks),
    });

    if (error) {
      toast.error("Failed to create exam");
      return;
    }

    toast.success("Exam created successfully!");
    setDialogOpen(false);
    reset();
    fetchExams();
  };

  const openResultsDialog = async (exam: any) => {
    setSelectedExam(exam);
    
    const { data: studentsData } = await supabase
      .from("students")
      .select("*, profiles:user_id(full_name)")
      .eq("class_id", exam.class_id);

    const { data: existingResults } = await supabase
      .from("exam_results")
      .select("*")
      .eq("exam_id", exam.id);

    const resultsMap: Record<string, { marks: string; grade: string }> = {};
    existingResults?.forEach((result) => {
      resultsMap[result.student_id] = {
        marks: result.marks_obtained?.toString() || "",
        grade: result.grade || "",
      };
    });

    setStudents(studentsData || []);
    setResults(resultsMap);
    setResultsDialogOpen(true);
  };

  const saveResults = async () => {
    if (!selectedExam) return;

    const resultsToSave = Object.entries(results).map(([studentId, data]) => ({
      exam_id: selectedExam.id,
      student_id: studentId,
      marks_obtained: data.marks ? parseFloat(data.marks) : null,
      grade: data.grade || null,
    }));

    const { error } = await supabase.from("exam_results").upsert(resultsToSave);

    if (error) {
      toast.error("Failed to save results");
      return;
    }

    toast.success("Results saved successfully!");
    setResultsDialogOpen(false);
  };

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Exam Management</h2>
            <p className="text-muted-foreground">Schedule exams and record results</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Schedule Exam
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Schedule New Exam</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Exam Title</Label>
                    <Input {...register("title")} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Term</Label>
                    <Select onValueChange={(value) => setValue("term", value)} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select term" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Term 1">Term 1</SelectItem>
                        <SelectItem value="Term 2">Term 2</SelectItem>
                        <SelectItem value="Term 3">Term 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea {...register("description")} rows={3} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Select onValueChange={(value) => setValue("subject_id", value)} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            {subject.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Class</Label>
                    <Select onValueChange={(value) => setValue("class_id", value)} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Exam Date</Label>
                    <Input type="date" {...register("exam_date")} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (mins)</Label>
                    <Input
                      type="number"
                      {...register("duration_minutes")}
                      required
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Total Marks</Label>
                    <Input
                      type="number"
                      {...register("total_marks")}
                      required
                      min="1"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  Schedule Exam
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Scheduled Exams</CardTitle>
            <CardDescription>All upcoming and past exams</CardDescription>
          </CardHeader>
          <CardContent>
            {exams.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No exams scheduled yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exams.map((exam) => (
                    <TableRow key={exam.id}>
                      <TableCell className="font-medium">{exam.title}</TableCell>
                      <TableCell>{exam.subject?.name}</TableCell>
                      <TableCell>{exam.class?.name}</TableCell>
                      <TableCell>
                        {new Date(exam.exam_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{exam.total_marks}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{exam.term}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openResultsDialog(exam)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Record Results
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={resultsDialogOpen} onOpenChange={setResultsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Exam Results - {selectedExam?.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Marks Obtained</TableHead>
                    <TableHead>Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        {student.profiles?.full_name}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          max={selectedExam?.total_marks}
                          value={results[student.id]?.marks || ""}
                          onChange={(e) =>
                            setResults({
                              ...results,
                              [student.id]: {
                                ...results[student.id],
                                marks: e.target.value,
                              },
                            })
                          }
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={results[student.id]?.grade || ""}
                          onValueChange={(value) =>
                            setResults({
                              ...results,
                              [student.id]: {
                                ...results[student.id],
                                grade: value,
                              },
                            })
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue placeholder="Grade" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A">A</SelectItem>
                            <SelectItem value="A-">A-</SelectItem>
                            <SelectItem value="B+">B+</SelectItem>
                            <SelectItem value="B">B</SelectItem>
                            <SelectItem value="B-">B-</SelectItem>
                            <SelectItem value="C+">C+</SelectItem>
                            <SelectItem value="C">C</SelectItem>
                            <SelectItem value="D">D</SelectItem>
                            <SelectItem value="F">F</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button onClick={saveResults} className="w-full">
                Save Results
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Exams;
