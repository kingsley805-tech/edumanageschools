import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export type SignUpMetadata = {
  email: string;
  password: string;
  fullName: string;
  role: string;
  schoolCode?: string;
  schoolId?: string;
  adminKey?: string;
  schoolName?: string;
  admissionPrefix?: string;
  registrationNumber?: string;
  gender?: string;
  phone?: string;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (meta: SignUpMetadata) => Promise<{ error: unknown; data?: unknown }>;
  signIn: (email: string, password: string) => Promise<{ error: unknown; data?: unknown }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (meta: SignUpMetadata) => {
    const { error, data } = await supabase.auth.signUp({
      email: meta.email,
      password: meta.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: meta.fullName,
          role: meta.role,
          school_code: meta.schoolCode ?? "",
          school_id: meta.schoolId ?? "",
          school_name: meta.schoolName ?? "",
          admin_key: meta.adminKey ?? "",
          admission_prefix: meta.admissionPrefix ?? "",
          registration_number: meta.registrationNumber ?? "",
          gender: meta.gender ?? "",
          phone: meta.phone ?? "",
        },
      },
    });

    return { error, data };
  };

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error, data };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <AuthContext.Provider value={{ user, session, signUp, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
