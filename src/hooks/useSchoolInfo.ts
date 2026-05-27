import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchSchoolById, resolveUserSchoolId } from "@/lib/schoolFetch";

interface School {
  id: string;
  school_name: string;
  school_code: string;
  logo_url: string | null;
  theme_primary?: string | null;
  theme_secondary?: string | null;
  theme_accent?: string | null;
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
    if (!user?.id) return;
    try {
      const schoolId = await resolveUserSchoolId(user.id);
      if (!schoolId) {
        setCurrentSchool(null);
        return;
      }
      const school = await fetchSchoolById(schoolId);
      if (school) {
        setCurrentSchool({
          id: school.id,
          school_name: school.school_name,
          school_code: school.school_code,
          logo_url: school.logo_url,
          theme_primary: school.theme_primary,
          theme_secondary: school.theme_secondary,
          theme_accent: school.theme_accent,
        });
      }
    } catch (error) {
      console.error("Error fetching school info:", error);
    } finally {
      setLoading(false);
    }
  };

  return { currentSchool, loading, refetch: fetchSchoolInfo };
};
