import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface School {
  id: string;
  school_name: string;
  school_code: string;
}

export const useSchoolInfo = () => {
  const { user } = useAuth();
  const [currentSchool, setCurrentSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSchoolInfo();
    } else {
      setCurrentSchool(null);
      setLoading(false);
    }
  }, [user]);

  const fetchSchoolInfo = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id, schools(id, school_name, school_code)")
        .eq("id", user?.id)
        .single();

      if (profile?.schools) {
        setCurrentSchool(profile.schools as unknown as School);
      }
    } catch (error) {
      console.error("Error fetching school info:", error);
    } finally {
      setLoading(false);
    }
  };

  return { currentSchool, loading, refetch: fetchSchoolInfo };
};
