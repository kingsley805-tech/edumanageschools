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
      <SelectTrigger className="w-auto min-w-[200px] bg-primary/10 border-primary/20">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-xs">
            {selectedSchool?.school_name.substring(0, 2).toUpperCase()}
          </div>
          <SelectValue placeholder="Select school" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {schools.map((school) => (
          <SelectItem key={school.id} value={school.id}>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>{school.school_name}</span>
              <span className="text-muted-foreground text-xs">
                ({school.school_code})
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
