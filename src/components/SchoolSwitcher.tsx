import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

interface School {
  id: string;
  school_name: string;
  school_code: string;
}

interface SchoolSwitcherProps {
  onSchoolChange?: (schoolId: string) => void;
}

export const SchoolSwitcher = ({ onSchoolChange }: SchoolSwitcherProps) => {
  const { user } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAssignedSchools();
    }
  }, [user]);

  const fetchAssignedSchools = async () => {
    try {
      // Fetch schools assigned to this super_admin
      const { data: assignedSchools, error } = await supabase
        .from("super_admin_schools")
        .select(`
          school_id,
          schools:school_id (
            id,
            school_name,
            school_code
          )
        `)
        .eq("user_id", user?.id);

      if (error) throw error;

      const schoolsList = assignedSchools
        ?.map((item: any) => item.schools)
        .filter(Boolean) as School[];

      setSchools(schoolsList || []);

      // Set first school as default if available
      if (schoolsList && schoolsList.length > 0 && !selectedSchoolId) {
        setSelectedSchoolId(schoolsList[0].id);
        onSchoolChange?.(schoolsList[0].id);
      }
    } catch (error) {
      console.error("Error fetching assigned schools:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSchoolChange = (schoolId: string) => {
    setSelectedSchoolId(schoolId);
    onSchoolChange?.(schoolId);
  };

  if (loading || schools.length === 0) {
    return null;
  }

  const selectedSchool = schools.find((s) => s.id === selectedSchoolId);

  return (
    <Select value={selectedSchoolId} onValueChange={handleSchoolChange}>
      <SelectTrigger className="w-auto min-w-[200px] h-9 rounded-lg border-border/60 bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
            {selectedSchool?.school_name.substring(0, 2).toUpperCase()}
          </div>
          <SelectValue placeholder="Select school" />
        </div>
      </SelectTrigger>
      <SelectContent className="rounded-xl border border-border bg-card shadow-xl p-1">
        <div className="px-3 py-2 border-b border-border/60 text-xs font-semibold text-muted-foreground">
          Switch School
        </div>
        {schools.map((school) => (
          <SelectItem key={school.id} value={school.id} className="rounded-lg py-2 cursor-pointer">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-foreground">{school.school_name}</span>
              <span className="text-muted-foreground text-xs font-mono">
                ({school.school_code})
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
