import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { Upload, FileText, Trash2, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ResourceForm {
  title: string;
  description: string;
  subject_id: string;
  class_id: string;
}

const Resources = () => {
  const [resources, setResources] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const { register, handleSubmit, reset, setValue } = useForm<ResourceForm>();

  useEffect(() => {
    fetchResources();
    fetchClasses();
    fetchSubjects();
  }, []);

  const fetchResources = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("resources")
      .select(`
        *,
        subject:subjects(name),
        class:classes(name)
      `)
      .eq("uploaded_by", user.id)
      .order("uploaded_at", { ascending: false });

    setResources(data || []);
  };

  const fetchClasses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get teacher's assigned classes only
    const { data: teacherData } = await supabase
      .from("teachers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (teacherData) {
      const { data: classSubjects } = await supabase
        .from("class_subjects")
        .select("classes(id, name)")
        .eq("teacher_id", teacherData.id);

      const uniqueClasses = Array.from(
        new Map(classSubjects?.map(item => [item.classes?.id, item.classes]) || []).values()
      ).filter(Boolean);
      setClasses(uniqueClasses as any);
    }
  };

  const fetchSubjects = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get teacher's assigned subjects only
    const { data: teacherData } = await supabase
      .from("teachers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (teacherData) {
      const { data: classSubjects } = await supabase
        .from("class_subjects")
        .select("subjects(id, name)")
        .eq("teacher_id", teacherData.id);

      const uniqueSubjects = Array.from(
        new Map(classSubjects?.map(item => [item.subjects?.id, item.subjects]) || []).values()
      ).filter(Boolean);
      setSubjects(uniqueSubjects as any);
    }
  };

  const onSubmit = async (data: ResourceForm) => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("resources")
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Failed to upload file");
      return;
    }

    const { data: urlData } = supabase.storage
      .from("resources")
      .getPublicUrl(filePath);

    const { error: insertError } = await supabase.from("resources").insert({
      ...data,
      file_url: urlData.publicUrl,
      file_type: fileExt,
    });

    if (insertError) {
      toast.error("Failed to save resource");
      return;
    }

    toast.success("Resource uploaded successfully!");
    setDialogOpen(false);
    reset();
    setFile(null);
    fetchResources();
  };

  const deleteResource = async (id: string, fileUrl: string) => {
    const fileName = fileUrl.split("/").pop();

    await supabase.storage.from("resources").remove([fileName || ""]);
    
    const { error } = await supabase.from("resources").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete resource");
      return;
    }

    toast.success("Resource deleted successfully!");
    fetchResources();
  };

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Resource Library</h2>
            <p className="text-muted-foreground">Upload study materials for students</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Upload Resource
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload New Resource</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input {...register("title")} required />
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

                <div className="space-y-2">
                  <Label>File</Label>
                  <Input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full">
                  Upload Resource
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {resources.length === 0 ? (
            <Card className="md:col-span-2 lg:col-span-3">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No resources uploaded yet</p>
              </CardContent>
            </Card>
          ) : (
            resources.map((resource) => (
              <Card key={resource.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <FileText className="h-8 w-8 text-primary" />
                    <Badge variant="outline">{resource.file_type?.toUpperCase()}</Badge>
                  </div>
                  <CardTitle className="text-lg">{resource.title}</CardTitle>
                  <CardDescription>{resource.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subject:</span>
                    <span className="font-medium">{resource.subject?.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Class:</span>
                    <span className="font-medium">{resource.class?.name}</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(resource.file_url, "_blank")}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteResource(resource.id, resource.file_url)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Resources;
