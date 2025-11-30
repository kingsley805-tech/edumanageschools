import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Megaphone, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const Announcements = () => {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("normal");
  const [targetRoles, setTargetRoles] = useState<string[]>(["admin", "teacher", "parent", "student"]);
  const { toast } = useToast();

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error fetching announcements", variant: "destructive" });
      return;
    }

    // Fetch creator profiles separately
    const announcementsWithProfiles = await Promise.all(
      (data || []).map(async (announcement) => {
        if (!announcement.created_by) return announcement;

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", announcement.created_by)
          .single();

        return {
          ...announcement,
          creator_name: profile?.full_name || "Unknown",
        };
      })
    );

    setAnnouncements(announcementsWithProfiles);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("announcements")
      .insert({
        title,
        body,
        priority,
        target_roles: targetRoles,
        created_by: user.id,
      });

    if (error) {
      toast({ title: "Error creating announcement", variant: "destructive" });
    } else {
      toast({ title: "Announcement created successfully" });
      setTitle("");
      setBody("");
      setPriority("normal");
      setTargetRoles(["admin", "teacher", "parent", "student"]);
      setShowForm(false);
      fetchAnnouncements();
    }
  };

  const toggleRole = (role: string) => {
    setTargetRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "default";
      case "normal": return "secondary";
      default: return "outline";
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Announcements</h2>
            <p className="text-muted-foreground">Broadcast messages to users</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-2 h-4 w-4" />
            New Announcement
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create Announcement</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Input
                    placeholder="Announcement Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Textarea
                    placeholder="Announcement Message"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                    rows={4}
                  />
                </div>
                <div>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Target Audience</p>
                  <div className="flex flex-wrap gap-4">
                    {["admin", "teacher", "parent", "student"].map((role) => (
                      <div key={role} className="flex items-center space-x-2">
                        <Checkbox
                          id={role}
                          checked={targetRoles.includes(role)}
                          onCheckedChange={() => toggleRole(role)}
                        />
                        <label htmlFor={role} className="text-sm capitalize cursor-pointer">
                          {role}s
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit">Create Announcement</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {announcements.map((announcement) => (
            <Card key={announcement.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-primary" />
                    <CardTitle>{announcement.title}</CardTitle>
                  </div>
                  <Badge variant={getPriorityColor(announcement.priority)}>
                    {announcement.priority}
                  </Badge>
                </div>
                <CardDescription>
                  By {announcement.creator_name} •{" "}
                  {format(new Date(announcement.created_at), "PPP")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4">{announcement.body}</p>
                <div className="flex gap-2">
                  {announcement.target_roles?.map((role: string) => (
                    <Badge key={role} variant="outline" className="capitalize">
                      {role}s
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Announcements;
