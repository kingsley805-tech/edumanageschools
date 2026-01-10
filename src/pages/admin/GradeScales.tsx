import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface GradeScale {
  id: string;
  name: string;
  min_score: number;
  max_score: number;
  grade: string;
  grade_point: number | null;
}

const GradeScales = () => {
  const { user } = useAuth();
  const [gradeScales, setGradeScales] = useState<GradeScale[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScale, setEditingScale] = useState<GradeScale | null>(null);
  const [formData, setFormData] = useState({ name: "", min_score: 0, max_score: 100, grade: "", grade_point: "" });

  useEffect(() => {
    fetchGradeScales();
  }, []);

  const fetchGradeScales = async () => {
    // Get current user's school_id for filtering
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", currentUser.id)
      .single();

    if (!profileData?.school_id) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("grade_scales")
      .select("*")
      .eq("school_id", profileData.school_id)
      .order("min_score", { ascending: false });
    if (!error && data) setGradeScales(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", user?.id).single();
    
    const payload = {
      name: formData.name,
      min_score: formData.min_score,
      max_score: formData.max_score,
      grade: formData.grade,
      grade_point: formData.grade_point ? parseFloat(formData.grade_point) : null,
    };

    if (editingScale) {
      const { error } = await supabase.from("grade_scales").update(payload).eq("id", editingScale.id);
      if (error) return toast.error("Failed to update grade scale");
      toast.success("Grade scale updated");
    } else {
      const { error } = await supabase.from("grade_scales").insert({ ...payload, school_id: profile?.school_id });
      if (error) return toast.error("Failed to create grade scale");
      toast.success("Grade scale created");
    }
    setDialogOpen(false);
    setEditingScale(null);
    setFormData({ name: "", min_score: 0, max_score: 100, grade: "", grade_point: "" });
    fetchGradeScales();
  };

  const handleEdit = (scale: GradeScale) => {
    setEditingScale(scale);
    setFormData({
      name: scale.name,
      min_score: scale.min_score,
      max_score: scale.max_score,
      grade: scale.grade,
      grade_point: scale.grade_point?.toString() || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("grade_scales").delete().eq("id", id);
    if (error) return toast.error("Failed to delete grade scale");
    toast.success("Grade scale deleted");
    fetchGradeScales();
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Grade Scales</h2>
            <p className="text-muted-foreground">Define grading scales and grade points</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingScale(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setFormData({ name: "", min_score: 0, max_score: 100, grade: "", grade_point: "" })}>
                <Plus className="mr-2 h-4 w-4" /> Add Grade Scale
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingScale ? "Edit" : "Add"} Grade Scale</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Scale Name</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Excellent" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Min Score (%)</Label>
                    <Input type="number" value={formData.min_score} onChange={(e) => setFormData({ ...formData, min_score: Number(e.target.value) })} required />
                  </div>
                  <div>
                    <Label>Max Score (%)</Label>
                    <Input type="number" value={formData.max_score} onChange={(e) => setFormData({ ...formData, max_score: Number(e.target.value) })} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Grade</Label>
                    <Input value={formData.grade} onChange={(e) => setFormData({ ...formData, grade: e.target.value })} placeholder="e.g., A+" required />
                  </div>
                  <div>
                    <Label>Grade Point (Optional)</Label>
                    <Input type="number" step="0.1" value={formData.grade_point} onChange={(e) => setFormData({ ...formData, grade_point: e.target.value })} placeholder="e.g., 4.0" />
                  </div>
                </div>
                <Button type="submit" className="w-full">{editingScale ? "Update" : "Create"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Grade Scale Configuration</CardTitle>
            <CardDescription>Define score ranges and corresponding grades</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Score Range</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Grade Point</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gradeScales.map((scale) => (
                  <TableRow key={scale.id}>
                    <TableCell className="font-medium">{scale.name}</TableCell>
                    <TableCell>{scale.min_score}% - {scale.max_score}%</TableCell>
                    <TableCell>{scale.grade}</TableCell>
                    <TableCell>{scale.grade_point || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(scale)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(scale.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {gradeScales.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No grade scales found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default GradeScales;
