import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Coins } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const ThemeSettings = lazy(() => import("@/components/ThemeSettings"));

const Settings = () => {
  const { role, loading: roleLoading } = useUserRole();
  const { user } = useAuth();
  const { glassmorphism, setGlassmorphism } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");

  useEffect(() => {
    if (user && role) {
      void fetchProfile();
    }
  }, [user, role]);

  const fetchProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, avatar_url")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        setProfile(data);
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
      }

      if (role === "student") {
        const { data: studentRow } = await supabase
          .from("students")
          .select("admission_no, admission_number")
          .eq("user_id", user.id)
          .maybeSingle();
        if (studentRow) {
          setAdmissionNumber(
            studentRow.admission_no ?? studentRow.admission_number ?? ""
          );
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast.success("Avatar updated successfully");
      fetchProfile();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        phone: phone,
      })
      .eq('id', user.id);

    if (error) {
      toast.error("Failed to update profile");
    } else {
      toast.success("Profile updated successfully");
      fetchProfile();
    }
  };

  // Wait for role to load before rendering
  if (roleLoading || !role) {
    return null;
  }

  // Map super_admin to admin for DashboardLayout
  const layoutRole = role === "super_admin" ? "admin" : (role as "admin" | "teacher" | "parent" | "student");

  return (
    <DashboardLayout role={layoutRole}>
      {/* Page Header — Metronic toolbar */}
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">
        <div className="flex min-w-0 flex-col justify-center gap-2">
          <h1 className="text-xl font-medium leading-none text-mono">Settings</h1>
          <div className="flex items-center gap-2 text-sm font-normal text-secondary-foreground">
            Manage your account preferences, profile details, and security settings
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="kt-card lg:col-span-2">
          <div className="kt-card-header flex justify-between items-center py-4 px-5">
            <div>
              <h3 className="kt-card-title">Profile Details</h3>
              <p className="text-xs text-secondary-foreground">Manage your personal information and contact details</p>
            </div>
          </div>
          <div className="kt-card-content p-5 space-y-6">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 md:gap-6">
                  <Avatar className="h-20 w-20 flex-shrink-0 border-2 border-border">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className="text-xl font-semibold bg-primary text-primary-foreground">
                      {fullName?.charAt(0) || admissionNumber?.charAt(0) || "S"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 w-full sm:w-auto text-center sm:text-left">
                    <Label htmlFor="avatar" className="cursor-pointer">
                      <div className="inline-flex items-center justify-center gap-2 text-sm text-primary hover:underline font-medium">
                        <i className="ki-filled ki-picture text-base" />
                        {uploading ? "Uploading..." : "Change avatar"}
                      </div>
                    </Label>
                    <Input
                      id="avatar"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                      disabled={uploading}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG or WEBP (max. 2MB)
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Enter your phone number"
                      className="h-10"
                    />
                  </div>
                </div>

                {role === "student" ? (
                  <div className="space-y-2">
                    <Label htmlFor="admission-number">
                      Admission number (login ID)
                    </Label>
                    <Input
                      id="admission-number"
                      value={admissionNumber}
                      disabled
                      className="bg-muted h-10 font-mono uppercase"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use this number with your password to sign in. Contact your school admin if it
                      is incorrect.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      value={user?.email || ""}
                      disabled
                      className="bg-muted h-10"
                    />
                    <p className="text-xs text-muted-foreground">
                      Contact admin to change your email
                    </p>
                  </div>
                )}

                <Button onClick={handleUpdateProfile} className="kt-btn kt-btn-primary">
                  Update Profile
                </Button>
              </>
            )}
          </div>
        </div>

          <Suspense fallback={
            <Card>
              <CardHeader className="p-4 md:p-6">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48 mt-2" />
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          }>
            <ThemeSettings />
          </Suspense>

          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-lg md:text-xl">Appearance</CardTitle>
              <CardDescription className="text-sm md:text-base">Customize the visual appearance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:p-6 pt-0">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <Label htmlFor="glassmorphism" className="text-sm md:text-base">Glassmorphism Effect</Label>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Apply a glass-like effect to card containers
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <Switch
                    id="glassmorphism"
                    checked={glassmorphism}
                    onCheckedChange={setGlassmorphism}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-lg md:text-xl">Notifications</CardTitle>
              <CardDescription className="text-sm md:text-base">Manage your notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:p-6 pt-0">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <Label htmlFor="notifications" className="text-sm md:text-base">Push Notifications</Label>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Receive push notifications
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <Switch
                    id="notifications"
                    checked={notifications}
                    onCheckedChange={setNotifications}
                  />
                </div>
              </div>
              {role !== "student" && (
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <Label htmlFor="email-alerts" className="text-sm md:text-base">
                      Email Alerts
                    </Label>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Receive email notifications
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <Switch
                      id="email-alerts"
                      checked={emailAlerts}
                      onCheckedChange={setEmailAlerts}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {(role === "admin" || role === "super_admin") && (
            <Card className="md:col-span-2">
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="text-lg md:text-xl flex items-center gap-2">
                  <Coins className="h-5 w-5" /> Currency & Billing
                </CardTitle>
                <CardDescription className="text-sm md:text-base">
                  Set your school's display currency, invoice prefix, and receipt footer used across invoices and reports.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <Button asChild>
                  <Link to="/admin/billing/settings">Open billing settings</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </DashboardLayout>
    );
  };

export default Settings;
