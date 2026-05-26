import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useSchoolTheme } from "@/contexts/SchoolThemeContext";
import { SchoolBrandColorPicker } from "@/components/SchoolBrandColorPicker";
import { BRAND_DEFAULTS, parseSchoolBrand, type BrandColors } from "@/lib/themeColors";
import { Upload, Building, Image, Save, Loader2, Palette } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const SchoolSettings = () => {
  const { user } = useAuth();
  const { role } = useUserRole();
  const { applyColors, refreshSchoolTheme } = useSchoolTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [school, setSchool] = useState<{
    id: string;
    school_name: string;
    school_code: string;
    logo_url: string | null;
    theme_primary: string | null;
    theme_secondary: string | null;
    theme_accent: string | null;
  } | null>(null);
  const [schoolName, setSchoolName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [brandColors, setBrandColors] = useState<BrandColors>({ ...BRAND_DEFAULTS });

  useEffect(() => {
    fetchSchoolData();
  }, [user]);

  const fetchSchoolData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      if (profile?.school_id) {
        const { data: schoolData, error: schoolError } = await supabase
          .from("schools")
          .select(
            "id, school_name, school_code, logo_url, theme_primary, theme_secondary, theme_accent"
          )
          .eq("id", profile.school_id)
          .single();

        if (schoolError) throw schoolError;

        setSchool(schoolData);
        setSchoolName(schoolData.school_name);
        setPreviewUrl(schoolData.logo_url);
        const colors = parseSchoolBrand(schoolData);
        setBrandColors(colors);
        applyColors(colors);
      }
    } catch (error: unknown) {
      console.error("Error fetching school:", error);
      toast.error("Failed to load school settings");
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !school) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size must be less than 2MB");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${school.id}.${fileExt}`;
      const filePath = `${fileName}`;

      if (school.logo_url) {
        const oldPath = school.logo_url.split("/").pop();
        if (oldPath) {
          await supabase.storage.from("school-logos").remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from("school-logos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("school-logos")
        .getPublicUrl(filePath);

      const logoUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from("schools")
        .update({ logo_url: logoUrl })
        .eq("id", school.id);

      if (updateError) throw updateError;

      setPreviewUrl(logoUrl);
      setSchool({ ...school, logo_url: logoUrl });
      toast.success("School logo updated successfully");
    } catch (error: unknown) {
      console.error("Error uploading logo:", error);
      toast.error("Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!school) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("schools")
        .update({ school_name: schoolName })
        .eq("id", school.id);

      if (error) throw error;

      setSchool({ ...school, school_name: schoolName });
      toast.success("School settings saved successfully");
    } catch (error: unknown) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBrandColors = async () => {
    if (!school) return;

    setSavingBrand(true);
    try {
      const { error } = await supabase
        .from("schools")
        .update({
          theme_primary: brandColors.primary,
          theme_secondary: brandColors.secondary,
          theme_accent: brandColors.accent,
        })
        .eq("id", school.id);

      if (error) throw error;

      setSchool({
        ...school,
        theme_primary: brandColors.primary,
        theme_secondary: brandColors.secondary,
        theme_accent: brandColors.accent,
      });
      applyColors(brandColors);
      await refreshSchoolTheme();
      toast.success("Brand colors saved — all users at your school will see the new theme");
    } catch (error: unknown) {
      console.error("Error saving brand:", error);
      toast.error("Failed to save brand colors");
    } finally {
      setSavingBrand(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const layoutRole = role === "super_admin" ? "admin" : (role as "admin" | "teacher" | "parent" | "student");

  if (!school) {
    return (
      <DashboardLayout role={layoutRole}>
        <div className="text-center py-8">
          <Building className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No school associated with your account</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={layoutRole}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">School Settings</h1>
          <p className="text-muted-foreground">
            Manage your school profile, logo, and brand colors (green, black, white by default)
          </p>
        </div>

        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Brand Colors
            </CardTitle>
            <CardDescription>
              Customize three colors for your entire school portal. Defaults are green (primary),
              black (secondary), and white (accent). Changes apply to all staff, parents, and
              students at your school.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SchoolBrandColorPicker
              colors={brandColors}
              onChange={setBrandColors}
              onPreview={applyColors}
            />
            <Button onClick={handleSaveBrandColors} disabled={savingBrand} className="w-full sm:w-auto">
              {savingBrand ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving colors...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save brand colors
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                School Logo
              </CardTitle>
              <CardDescription>Upload a custom logo or badge for your school</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24 border-2 border-border">
                  <AvatarImage src={previewUrl || undefined} alt={school.school_name} />
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                    {getInitials(school.school_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Label htmlFor="logo-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-muted transition-colors">
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {uploading ? "Uploading..." : "Upload Logo"}
                    </div>
                    <Input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={uploading}
                    />
                  </Label>
                  <p className="text-xs text-muted-foreground">Recommended: Square image, max 2MB</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                School Information
              </CardTitle>
              <CardDescription>Update your school&apos;s name and details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="school-name">School Name</Label>
                <Input
                  id="school-name"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="Enter school name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-code">School Code</Label>
                <Input
                  id="school-code"
                  value={school.school_code}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">School code cannot be changed</p>
              </div>
              <Button
                onClick={handleSaveSettings}
                disabled={saving || schoolName === school.school_name}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SchoolSettings;
