import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Hash, Plus, Users, Briefcase, RefreshCw, Download, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface RegistrationNumber {
  id: string;
  school_id: string;
  number_type: "student" | "employee";
  registration_number: string;
  status: "unused" | "used";
  assigned_user_id: string | null;
  generated_by: string | null;
  generated_at: string;
  used_at: string | null;
  assigned_user?: {
    full_name: string;
    email: string;
  };
  generator?: {
    full_name: string;
  };
}

const NumberGenerator = () => {
  const [numbers, setNumbers] = useState<RegistrationNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [numberType, setNumberType] = useState<"student" | "employee">("student");
  const [prefix, setPrefix] = useState("");
  const [bulkCount, setBulkCount] = useState(1);
  const [startNumber, setStartNumber] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "student" | "employee">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "unused" | "used">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchNumbers();
  }, []);

  const fetchNumbers = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!profile?.school_id) return;

    const { data, error } = await supabase
      .from("registration_numbers")
      .select(`
        *,
        assigned_user:profiles!registration_numbers_assigned_user_id_fkey(full_name, email),
        generator:profiles!registration_numbers_generated_by_fkey(full_name)
      `)
      .eq("school_id", profile.school_id)
      .order("generated_at", { ascending: false });

    if (error) {
      console.error("Error fetching numbers:", error);
      toast({ title: "Error fetching registration numbers", variant: "destructive" });
    } else {
      setNumbers((data || []) as RegistrationNumber[]);
    }
    setLoading(false);
  };

  const generateNumbers = async () => {
    setGenerating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!profile?.school_id) {
      toast({ title: "Error: No school found", variant: "destructive" });
      setGenerating(false);
      return;
    }

    const numbersToInsert = [];
    for (let i = 0; i < bulkCount; i++) {
      const num = startNumber + i;
      const paddedNum = num.toString().padStart(4, '0');
      const registrationNumber = prefix ? `${prefix}${paddedNum}` : paddedNum;
      
      numbersToInsert.push({
        school_id: profile.school_id,
        number_type: numberType,
        registration_number: registrationNumber,
        status: "unused",
        generated_by: user.id,
      });
    }

    const { error } = await supabase
      .from("registration_numbers")
      .insert(numbersToInsert);

    if (error) {
      if (error.code === "23505") {
        toast({ 
          title: "Duplicate number detected", 
          description: "Some numbers already exist. Please use a different prefix or starting number.",
          variant: "destructive" 
        });
      } else {
        toast({ title: "Error generating numbers", description: error.message, variant: "destructive" });
      }
    } else {
      // Log the action
      await supabase.from("audit_logs").insert({
        school_id: profile.school_id,
        action_type: "generate",
        entity_type: "registration_number",
        performed_by: user.id,
        details: {
          number_type: numberType,
          count: bulkCount,
          prefix: prefix,
          start_number: startNumber,
        },
      });

      toast({ title: `Generated ${bulkCount} ${numberType} number(s) successfully` });
      setShowGenerateDialog(false);
      setPrefix("");
      setBulkCount(1);
      setStartNumber(1);
      fetchNumbers();
    }
    setGenerating(false);
  };

  const filteredNumbers = numbers.filter((num) => {
    if (filterType !== "all" && num.number_type !== filterType) return false;
    if (filterStatus !== "all" && num.status !== filterStatus) return false;
    if (searchQuery && !num.registration_number.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    totalStudent: numbers.filter(n => n.number_type === "student").length,
    usedStudent: numbers.filter(n => n.number_type === "student" && n.status === "used").length,
    totalEmployee: numbers.filter(n => n.number_type === "employee").length,
    usedEmployee: numbers.filter(n => n.number_type === "employee" && n.status === "used").length,
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Registration Numbers</h2>
            <p className="text-muted-foreground">Generate and manage student/employee registration numbers</p>
          </div>
          <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Generate Numbers
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Registration Numbers</DialogTitle>
                <DialogDescription>
                  Create new registration numbers for students or employees
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Number Type</Label>
                  <Select value={numberType} onValueChange={(v: "student" | "employee") => setNumberType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Student Number
                        </div>
                      </SelectItem>
                      <SelectItem value="employee">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          Employee Number
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Prefix (Optional)</Label>
                  <Input
                    placeholder="e.g., STU, EMP, 2024"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                  />
                  <p className="text-xs text-muted-foreground">
                    Letters/numbers to add before the number (e.g., STU0001)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Starting Number</Label>
                    <Input
                      type="number"
                      min={1}
                      value={startNumber}
                      onChange={(e) => setStartNumber(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={bulkCount}
                      onChange={(e) => setBulkCount(Math.min(100, parseInt(e.target.value) || 1))}
                    />
                  </div>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Preview:</p>
                  <p className="text-sm text-muted-foreground">
                    {prefix}{startNumber.toString().padStart(4, '0')} 
                    {bulkCount > 1 && ` to ${prefix}${(startNumber + bulkCount - 1).toString().padStart(4, '0')}`}
                  </p>
                </div>

                <Button 
                  onClick={generateNumbers} 
                  className="w-full"
                  disabled={generating}
                >
                  {generating ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Hash className="mr-2 h-4 w-4" />
                      Generate {bulkCount} Number{bulkCount > 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Student Numbers</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {stats.totalStudent}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {stats.usedStudent} used, {stats.totalStudent - stats.usedStudent} available
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Employee Numbers</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-accent" />
                {stats.totalEmployee}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {stats.usedEmployee} used, {stats.totalEmployee - stats.usedEmployee} available
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Available Student</CardDescription>
              <CardTitle className="text-2xl text-primary">
                {stats.totalStudent - stats.usedStudent}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Ready for signup</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Available Employee</CardDescription>
              <CardTitle className="text-2xl text-accent">
                {stats.totalEmployee - stats.usedEmployee}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Ready for signup</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Registration Numbers</CardTitle>
            <CardDescription>View and manage all generated registration numbers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="unused">Unused</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={fetchNumbers}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Loading...</p>
              </div>
            ) : filteredNumbers.length === 0 ? (
              <div className="text-center py-8">
                <Hash className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Registration Numbers</h3>
                <p className="text-muted-foreground mb-4">
                  Generate numbers for students and employees to register
                </p>
                <Button onClick={() => setShowGenerateDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Generate First Numbers
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Registration Number</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Generated</TableHead>
                      <TableHead>Used On</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNumbers.map((num) => (
                      <TableRow key={num.id}>
                        <TableCell className="font-mono font-medium">
                          {num.registration_number}
                        </TableCell>
                        <TableCell>
                          <Badge variant={num.number_type === "student" ? "default" : "secondary"}>
                            {num.number_type === "student" ? (
                              <><Users className="h-3 w-3 mr-1" /> Student</>
                            ) : (
                              <><Briefcase className="h-3 w-3 mr-1" /> Employee</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={num.status === "unused" ? "outline" : "default"}>
                            {num.status === "unused" ? "Available" : "Used"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {num.assigned_user ? (
                            <div>
                              <p className="font-medium">{num.assigned_user.full_name}</p>
                              <p className="text-xs text-muted-foreground">{num.assigned_user.email}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{format(new Date(num.generated_at), "PP")}</p>
                            {num.generator && (
                              <p className="text-xs text-muted-foreground">by {num.generator.full_name}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {num.used_at ? (
                            format(new Date(num.used_at), "PP")
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default NumberGenerator;