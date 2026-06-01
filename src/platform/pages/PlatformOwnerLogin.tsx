// @ts-nocheck
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { logPlatformOwnerLogin } from "@/lib/auditLog";

/**
 * Hidden system-owner login — not linked from tenant portals or public /auth.
 * URL: /platform-admin/login
 */
export default function PlatformOwnerLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signOut, user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const redirectTo = searchParams.get("redirect") || "/platform";

  useEffect(() => {
    if (!user || roleLoading) return;
    if (role === "super_admin") {
      navigate(redirectTo, { replace: true });
    } else if (role) {
      void signOut();
      toast.error("This portal is for the software owner only.");
    }
  }, [user, role, roleLoading, navigate, redirectTo, signOut]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    if (error) {
      await logPlatformOwnerLogin(false, email, error.message);
      toast.error(error.message);
      setLoading(false);
      return;
    }
    await logPlatformOwnerLogin(true, email);
    toast.success("Welcome, System Owner");
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500/20">
            <Shield className="h-8 w-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">System Owner Portal</h1>
          <p className="mt-2 text-sm text-slate-400">
            Restricted access · Software owner / developer only
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="owner-email" className="text-slate-200">
              Owner email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                id="owner-email"
                type="email"
                autoComplete="username"
                className="border-slate-700 bg-slate-800 pl-10 text-white"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="owner-password" className="text-slate-200">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                id="owner-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="border-slate-700 bg-slate-800 pl-10 pr-10 text-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-500" disabled={loading}>
            {loading ? "Signing in…" : "Sign in to platform control"}
          </Button>
        </form>

        <p className="text-center text-xs text-slate-500">
          Login attempts are audited (IP, device). MFA can be enabled on your Supabase project.
        </p>
      </div>
    </div>
  );
}
