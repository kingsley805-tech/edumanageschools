import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

const invoiceSchema = z.object({
  student_id: z.string().min(1, "Student is required"),
  fee_structure_id: z.string().min(1, "Fee structure is required"),
  due_date: z.string().min(1, "Due date is required"),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

const Fees = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalCollected: 0, outstanding: 0, overdue: 0, pendingCount: 0, overdueCount: 0 });
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
  });

  useEffect(() => {
    fetchInvoices();
    fetchStudents();
    fetchFeeStructures();
  }, []);

  const fetchInvoices = async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select(`
        *,
        students(admission_no, profiles(full_name)),
        fee_structures(name)
      `)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setInvoices(data);
      
      // Calculate stats from actual data
      const now = new Date();
      const totalCollected = data
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + Number(inv.amount), 0);
      
      const unpaidInvoices = data.filter(inv => inv.status !== 'paid');
      const outstanding = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
      
      const overdueInvoices = unpaidInvoices.filter(inv => 
        inv.due_date && new Date(inv.due_date) < now
      );
      const overdue = overdueInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
      
      setStats({
        totalCollected,
        outstanding,
        overdue,
        pendingCount: unpaidInvoices.length,
        overdueCount: overdueInvoices.length,
      });
    }
  };

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from("students")
      .select("id, admission_no, profiles(full_name)");
    
    if (!error && data) {
      setStudents(data);
    }
  };

  const fetchFeeStructures = async () => {
    const { data, error } = await supabase
      .from("fee_structures")
      .select("*");
    
    if (!error && data) {
      setFeeStructures(data);
    }
  };

  const onSubmit = async (data: InvoiceFormData) => {
    try {
      const feeStructure = feeStructures.find(f => f.id === data.fee_structure_id);
      
      const invoiceNo = `INV-${Date.now().toString().slice(-6)}`;
      
      const { error } = await supabase
        .from("invoices")
        .insert({
          invoice_no: invoiceNo,
          student_id: data.student_id,
          fee_structure_id: data.fee_structure_id,
          amount: feeStructure.amount,
          due_date: data.due_date,
          status: 'unpaid',
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invoice created successfully",
      });

      setOpen(false);
      reset();
      fetchInvoices();
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
            <h2 className="text-3xl font-bold tracking-tight">Fees & Payments</h2>
            <p className="text-muted-foreground">Manage fee structures and track payments</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Invoice
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Invoice</DialogTitle>
                <DialogDescription>Generate an invoice for a student</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="student_id">Student</Label>
                  <Select onValueChange={(value) => setValue("student_id", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.admission_no} - {student.profiles?.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.student_id && <p className="text-sm text-destructive">{errors.student_id.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fee_structure_id">Fee Type</Label>
                  <Select onValueChange={(value) => setValue("fee_structure_id", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select fee type" />
                    </SelectTrigger>
                    <SelectContent>
                      {feeStructures.map((fee) => (
                        <SelectItem key={fee.id} value={fee.id}>
                          {fee.name} - ${fee.amount}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.fee_structure_id && <p className="text-sm text-destructive">{errors.fee_structure_id.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input id="due_date" type="date" {...register("due_date")} />
                  {errors.due_date && <p className="text-sm text-destructive">{errors.due_date.message}</p>}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit">Create Invoice</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalCollected.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">From paid invoices</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              <TrendingUp className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.outstanding.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{stats.pendingCount} pending invoices</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.overdue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{stats.overdueCount} overdue invoices</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="structures">Fee Structures</TabsTrigger>
          </TabsList>
          <TabsContent value="invoices" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Invoices</CardTitle>
                <CardDescription>Track all student fee invoices</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice No.</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No invoices found. Create your first invoice to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoice_no}</TableCell>
                          <TableCell>{invoice.students?.profiles?.full_name}</TableCell>
                          <TableCell>${invoice.amount}</TableCell>
                          <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge className={invoice.status === 'paid' ? 'bg-success' : 'text-warning border-warning'} variant={invoice.status === 'paid' ? 'default' : 'outline'}>
                              {invoice.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="structures" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Fee Structures</CardTitle>
                <CardDescription>Manage standard fee categories</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feeStructures.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No fee structures found. Add fee structures in the dedicated page.
                        </TableCell>
                      </TableRow>
                    ) : (
                      feeStructures.map((fee) => (
                        <TableRow key={fee.id}>
                          <TableCell className="font-medium">{fee.name}</TableCell>
                          <TableCell>{fee.description || "—"}</TableCell>
                          <TableCell>${fee.amount.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => navigate('/admin/fee-structures')}
                            >
                              Manage
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Fees;
