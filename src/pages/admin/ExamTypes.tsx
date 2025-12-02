import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ExamType {
  id: string;
  name: string;
  category: string;
  description: string | null;
}

const ExamTypes = () => {
  const { user } = useAuth();
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ExamType | null>(null);
  const [formData, setFormData] = useState({ name: "", category: "term", description: "" });

  useEffect(() => {
    fetchExamTypes();
  }, []);

  const fetchExamTypes = async () => {
    const { data, error } = await supabase.from("exam_types").select("*").order("name");
    if (!error && data) setExamTypes(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", user?.id).single();
    
    if (editingType) {
      const { error } = await supabase.from("exam_types").update(formData).eq("id", editingType.id);
      if (error) return toast.error("Failed to update exam type");
      toast.success("Exam type updated");
    } else {
      const { error } = await supabase.from("exam_types").insert({ ...formData, school_id: profile?.school_id });
      if (error) return toast.error("Failed to create exam type");
      toast.success("Exam type created");
    }
    setDialogOpen(false);
    setEditingType(null);
    setFormData({ name: "", category: "term", description: "" });
    fetchExamTypes();
  };

  const handleEdit = (type: ExamType) => {
    setEditingType(type);
    setFormData({ name: type.name, category: type.category, description: type.description || "" });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("exam_types").delete().eq("id", id);
    if (error) return toast.error("Failed to delete exam type");
    toast.success("Exam type deleted");
    fetchExamTypes();
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Exam Types</h2>
            <p className="text-muted-foreground">Manage exam categories and types</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingType(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setFormData({ name: "", category: "term", description: "" })}>
                <Plus className="mr-2 h-4 w-4" /> Add Exam Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingType ? "Edit" : "Add"} Exam Type</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="term">Term-based (Midterm, Final)</SelectItem>
                      <SelectItem value="category">Category-based (Quiz, Project)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                </div>
                <Button type="submit" className="w-full">{editingType ? "Update" : "Create"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Exam Types</CardTitle>
            <CardDescription>Configure different types of examinations</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {examTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell className="capitalize">{type.category}</TableCell>
                    <TableCell>{type.description || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(type)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(type.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {examTypes.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No exam types found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ExamTypes;
