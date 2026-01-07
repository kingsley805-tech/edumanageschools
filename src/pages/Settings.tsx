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
import { Camera } from "lucide-react";
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

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Map super_admin to admin for DashboardLayout
  const layoutRole = role === "super_admin" ? "admin" : (role as "admin" | "teacher" | "parent" | "student");

  return (
    <DashboardLayout role={layoutRole}>
      <div className="space-y-4 md:space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-sm md:text-base text-muted-foreground">Manage your account preferences</p>
        </div>

        <div className="grid gap-4 md:gap-6 md:grid-cols-2">
          <Card className="md:col-span-2">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-lg md:text-xl">Profile</CardTitle>
              <CardDescription className="text-sm md:text-base">Manage your profile information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6 p-4 md:p-6 pt-0">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-24 rounded-full mx-auto sm:mx-0" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 md:gap-6">
                <Avatar className="h-20 w-20 md:h-24 md:w-24 flex-shrink-0">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="text-xl md:text-2xl">
                    {fullName?.charAt(0) || user?.email?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 w-full sm:w-auto text-center sm:text-left">
                  <Label htmlFor="avatar" className="cursor-pointer">
                    <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-primary hover:underline">
                      <Camera className="h-4 w-4" />
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
                  <Label htmlFor="fullName" className="text-sm md:text-base">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="text-base py-5 md:py-6"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm md:text-base">Phone Number</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter your phone number"
                    className="text-base py-5 md:py-6"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm md:text-base">Email Address</Label>
                <Input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted text-base py-5 md:py-6"
                />
                <p className="text-xs text-muted-foreground">
                  Contact admin to change your email
                </p>
              </div>

              <Button onClick={handleUpdateProfile} className="w-full sm:w-auto">
                Update Profile
              </Button>
              </>
              )}
            </CardContent>
          </Card>

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
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <Label htmlFor="email" className="text-sm md:text-base">Email Alerts</Label>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Receive email notifications
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <Switch
                    id="email"
                    checked={emailAlerts}
                    onCheckedChange={setEmailAlerts}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
