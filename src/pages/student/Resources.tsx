import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

const Resources = () => {
  const { user } = useAuth();
  const [resources, setResources] = useState<any[]>([]);
  const [studentClass, setStudentClass] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchStudentClass();
    }
  }, [user]);

  useEffect(() => {
    if (studentClass) {
      fetchResources();
    }
  }, [studentClass]);

  const fetchStudentClass = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("students")
      .select("class_id")
      .eq("user_id", user.id)
      .single();

    setStudentClass(data?.class_id || null);
  };

  const fetchResources = async () => {
    if (!studentClass) return;

    const { data } = await supabase
      .from("resources")
      .select(`
        *,
        subject:subjects(name),
        class:classes(name)
      `)
      .eq("class_id", studentClass)
      .order("uploaded_at", { ascending: false });

    setResources(data || []);
  };

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Resource Library</h2>
          <p className="text-muted-foreground">Download study materials and notes</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {resources.length === 0 ? (
            <Card className="md:col-span-2 lg:col-span-3">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No resources available yet</p>
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
                    <span className="text-muted-foreground">Uploaded:</span>
                    <span className="font-medium">
                      {new Date(resource.uploaded_at).toLocaleDateString()}
                    </span>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => window.open(resource.file_url, "_blank")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
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
