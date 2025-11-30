import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useStudentData = () => {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudentData = async () => {
      if (!user) return;

      const { data } = await supabase
        .from("students")
        .select("id, class_id")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setStudentId(data.id);
        setClassId(data.class_id);
      }
      setLoading(false);
    };

    fetchStudentData();
  }, [user]);

  return { studentId, classId, loading };
};
