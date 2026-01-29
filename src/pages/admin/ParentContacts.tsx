import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, Users, Search, Pencil, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ParentContact {
  id: string;
  user_id: string;
  phone: string | null;
  address: string | null;
  emergency_contact: string | null;
  profiles: {
    full_name: string | null;
    email: string;
    phone: string | null;
  } | null;
  children: {
    id: string;
    admission_no: string | null;
    profiles: { full_name: string | null } | null;
    classes: { name: string } | null;
  }[];
}

const ParentContacts = () => {
  const [parents, setParents] = useState<ParentContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingParent, setEditingParent] = useState<ParentContact | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    phone: "",
    address: "",
    emergency_contact: "",
  });

  useEffect(() => {
    fetchParents();
  }, []);

  const fetchParents = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!profileData?.school_id) return;

    // Fetch parents with their linked children
    const { data: parentsData, error } = await supabase
      .from("parents")
      .select(`
        id,
        user_id,
        phone,
        address,
        emergency_contact,
        profiles(full_name, email, phone)
      `)
      .eq("school_id", profileData.school_id);

    if (error) {
      console.error("Error fetching parents:", error);
      return;
    }

    // For each parent, get their linked children
    const parentsWithChildren = await Promise.all(
      (parentsData || []).map(async (parent) => {
        const { data: children } = await supabase
          .from("students")
          .select(`
            id,
            admission_no,
            profiles(full_name),
            classes(name)
          `)
          .eq("guardian_id", parent.id);

        return {
          ...parent,
          children: children || [],
        };
      })
    );

    setParents(parentsWithChildren as ParentContact[]);
    setLoading(false);
  };

  const handleEdit = (parent: ParentContact) => {
    setEditingParent(parent);
    setEditForm({
      phone: parent.phone || parent.profiles?.phone || "",
      address: parent.address || "",
      emergency_contact: parent.emergency_contact || "",
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingParent) return;

    const { error } = await supabase
      .from("parents")
      .update({
        phone: editForm.phone || null,
        address: editForm.address || null,
        emergency_contact: editForm.emergency_contact || null,
      })
      .eq("id", editingParent.id);

    if (error) {
      toast.error("Failed to update parent contact");
      return;
    }

    toast.success("Parent contact updated");
    setEditDialogOpen(false);
    fetchParents();
  };

  const filteredParents = parents.filter((parent) => {
    const searchLower = searchQuery.toLowerCase();
    const parentName = parent.profiles?.full_name?.toLowerCase() || "";
    const childNames = parent.children.map(c => c.profiles?.full_name?.toLowerCase() || "").join(" ");
    return parentName.includes(searchLower) || childNames.includes(searchLower);
  });

  // Group parents by child for better organization
  const parentsByChild = filteredParents.reduce((acc, parent) => {
    parent.children.forEach((child) => {
      const childKey = child.id;
      if (!acc[childKey]) {
        acc[childKey] = {
          child,
          parents: [],
        };
      }
      acc[childKey].parents.push(parent);
    });
    // Also include parents without children
    if (parent.children.length === 0) {
      const noChildKey = `no-child-${parent.id}`;
      acc[noChildKey] = {
        child: null,
        parents: [parent],
      };
    }
    return acc;
  }, {} as Record<string, { child: ParentContact["children"][0] | null; parents: ParentContact[] }>);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Parent Contacts</h2>
          <p className="text-muted-foreground">Manage parent contact details organized by student</p>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by parent or child name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading parent contacts...
            </CardContent>
          </Card>
        ) : Object.keys(parentsByChild).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No parent contacts found. Parents are linked when they register with student numbers.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {Object.entries(parentsByChild).map(([key, { child, parents: childParents }]) => (
              <Card key={key}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5" />
                    {child ? (
                      <>
                        {child.profiles?.full_name || "Unknown Student"}
                        <Badge variant="outline" className="ml-2">
                          {child.admission_no || "No ID"}
                        </Badge>
                        {child.classes?.name && (
                          <Badge variant="secondary" className="ml-1">
                            {child.classes.name}
                          </Badge>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Unlinked Parents</span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {childParents.length} parent{childParents.length !== 1 ? "s" : ""} registered
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parent Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Emergency Contact</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {childParents.map((parent) => (
                        <TableRow key={parent.id}>
                          <TableCell className="font-medium">
                            {parent.profiles?.full_name || "N/A"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {parent.profiles?.email || "N/A"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {parent.phone || parent.profiles?.phone || "Not set"}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {parent.address || "Not set"}
                          </TableCell>
                          <TableCell>
                            {parent.emergency_contact || "Not set"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(parent)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Edit Contact - {editingParent?.profiles?.full_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Phone Number</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <Label>Address</Label>
                <Input
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="Enter address"
                />
              </div>
              <div>
                <Label>Emergency Contact</Label>
                <Input
                  value={editForm.emergency_contact}
                  onChange={(e) => setEditForm({ ...editForm, emergency_contact: e.target.value })}
                  placeholder="Enter emergency contact"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default ParentContacts;
