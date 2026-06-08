// @ts-nocheck
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, KeyRound, Copy, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";

type StudentRow = {
  user_id: string;
  full_name: string;
  email: string | null;
  admission_number: string | null;
  class_name: string | null;
};

const StudentPasswordRecovery = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<StudentRow[]>([]);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [tempPasswordModal, setTempPasswordModal] = useState<{
    name: string;
    email: string;
    password: string;
  } | null>(null);

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      // Look up admin's school
      const { data: me } = await supabase.from("profiles").select("school_id").eq("id", user!.id).maybeSingle();
      const schoolId = me?.school_id;

      const q = query.trim();
      let req = supabase
        .from("students")
        .select("user_id, full_name, admission_number, admission_no, classes(name), profiles!students_user_id_fkey(email, full_name)")
        .limit(20);
      if (schoolId) req = req.eq("school_id", schoolId);
      // Filter
      req = req.or(
        `full_name.ilike.%${q}%,admission_number.ilike.%${q}%,admission_no.ilike.%${q}%`
      );
      const { data, error } = await req;
      if (error) throw error;
      const rows: StudentRow[] = (data ?? [])
        .filter((r: any) => r.user_id)
        .map((r: any) => ({
          user_id: r.user_id,
          full_name: r.profiles?.full_name ?? r.full_name ?? "—",
          email: r.profiles?.email ?? null,
          admission_number: r.admission_number ?? r.admission_no ?? null,
          class_name: r.classes?.name ?? null,
        }));
      setResults(rows);
      if (rows.length === 0) toast.message("No students found.");
    } catch (err: any) {
      toast.error(err?.message ?? "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const resetPassword = async (s: StudentRow) => {
    if (!confirm(`Generate a new temporary password for ${s.full_name}? They will be required to change it on next login.`)) return;
    setResettingId(s.user_id);
    try {
      const { data, error } = await supabase.functions.invoke("password-reset-otp", {
        body: { action: "admin_reset_student", student_user_id: s.user_id, force_change: true },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message ?? "Reset failed");
      setTempPasswordModal({
        name: s.full_name,
        email: s.email ?? "",
        password: data.temporary_password,
      });
      toast.success("Temporary password generated.");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not reset password.");
    } finally {
      setResettingId(null);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Could not copy.");
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <KeyRound className="h-6 w-6" /> Student Password Recovery
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search for a student in your school and generate a secure temporary password. Passwords are never stored in plain text; we cannot reveal existing passwords.
        </p>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Security</AlertTitle>
        <AlertDescription>
          Temporary passwords are shown <strong>once</strong> on the next screen — copy and deliver them to the student or guardian via a secure channel. The student will be required to change it on next login. All resets are recorded in audit logs.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Find a student</CardTitle>
          <CardDescription>Search by name or admission number.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={search} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="e.g. John or MINGO-Stu-2026-001"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={searching || !query.trim()}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </form>

          {results.length > 0 && (
            <div className="mt-6 space-y-2">
              {results.map((s) => (
                <div
                  key={s.user_id}
                  className="flex items-center justify-between gap-4 border rounded-lg p-3 hover:bg-accent/30 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{s.full_name}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-0.5">
                      {s.admission_number && <Badge variant="outline">{s.admission_number}</Badge>}
                      {s.class_name && <span>{s.class_name}</span>}
                      {s.email && <span className="truncate">{s.email}</span>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => resetPassword(s)}
                    disabled={resettingId === s.user_id}
                  >
                    {resettingId === s.user_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <><KeyRound className="h-4 w-4 mr-1" /> Reset password</>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {tempPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" /> Temporary password
              </CardTitle>
              <CardDescription>
                For <strong>{tempPasswordModal.name}</strong>{tempPasswordModal.email ? ` (${tempPasswordModal.email})` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This password is shown <strong>once</strong>. Copy it now and share it via a secure channel. The student must change it on next login.
                </AlertDescription>
              </Alert>
              <div>
                <Label className="text-xs">Temporary password</Label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={tempPasswordModal.password} className="font-mono text-lg tracking-wider" />
                  <Button type="button" variant="outline" onClick={() => copy(tempPasswordModal.password)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setTempPasswordModal(null)}>I've copied it</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default StudentPasswordRecovery;
