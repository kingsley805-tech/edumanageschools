import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

const teacherSchema = z.object({
  employee_no: z.string().min(1, "Employee number is required"),
  email: z.string().email("Invalid email address"),
  full_name: z.string().min(1, "Full name is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  subject_specialty: z.string().min(1, "Subject specialty is required"),
});

type TeacherFormData = z.infer<typeof teacherSchema>;

const Teachers = () => {
  const [open, setOpen] = useState(false);
  const [teachers, setTeachers] = useState<any[]>([]);
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<TeacherFormData>({
    resolver: zodResolver(teacherSchema),
  });

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    const { data, error } = await supabase
      .from("teachers")
      .select(`
        *,
        profiles(full_name, email)
      `);
    
    if (!error && data) {
      setTeachers(data);
    }
  };

  const onSubmit = async (data: TeacherFormData) => {
    try {
      // Get current user's school_id and school_code
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profileData } = await supabase
        .from("profiles")
        .select("school_id, schools(school_code)")
        .eq("id", user.id)
        .single();

      if (!profileData?.school_id) throw new Error("School not found");
      const schoolCode = (profileData.schools as any)?.school_code;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
            role: 'teacher',
            school_code: schoolCode,
          },
        },
      });

      if (authError) throw authError;

      const { error: teacherError } = await supabase
        .from("teachers")
        .insert({
          user_id: authData.user?.id,
          employee_no: data.employee_no,
          subject_specialty: data.subject_specialty,
          school_id: profileData.school_id,
        });

      if (teacherError) throw teacherError;

      toast({
        title: "Success",
        description: "Teacher added successfully",
      });

      setOpen(false);
      reset();
      fetchTeachers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Teachers</h2>
            <p className="text-muted-foreground">Manage teaching staff</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Teacher
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Teacher</DialogTitle>
                <DialogDescription>Enter teacher information to create a new account</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employee_no">Employee Number</Label>
                    <Input id="employee_no" {...register("employee_no")} />
                    {errors.employee_no && <p className="text-sm text-destructive">{errors.employee_no.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input id="full_name" {...register("full_name")} />
                    {errors.full_name && <p className="text-sm text-destructive">{errors.full_name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" {...register("email")} />
                    {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" {...register("password")} />
                    {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="subject_specialty">Subject Specialty</Label>
                    <Input id="subject_specialty" {...register("subject_specialty")} />
                    {errors.subject_specialty && <p className="text-sm text-destructive">{errors.subject_specialty.message}</p>}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit">Add Teacher</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Teachers</CardTitle>
                <CardDescription>View and manage teacher information</CardDescription>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search teachers..." className="pl-10 w-64" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No teachers found. Add your first teacher to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  teachers.map((teacher) => (
                    <TableRow key={teacher.id}>
                      <TableCell className="font-medium">{teacher.employee_no}</TableCell>
                      <TableCell>{teacher.profiles?.full_name}</TableCell>
                      <TableCell>{teacher.subject_specialty}</TableCell>
                      <TableCell>{teacher.profiles?.email}</TableCell>
                      <TableCell>
                        <Badge className="bg-success">Active</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">View</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Teachers;
