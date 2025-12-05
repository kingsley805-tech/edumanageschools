import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, Building, Image, Save, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const SchoolSettings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [school, setSchool] = useState<{
    id: string;
    school_name: string;
    school_code: string;
    logo_url: string | null;
  } | null>(null);
  const [schoolName, setSchoolName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchSchoolData();
  }, [user]);

  const fetchSchoolData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get user's school
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      if (profile?.school_id) {
        const { data: schoolData, error: schoolError } = await supabase
          .from("schools")
          .select("id, school_name, school_code, logo_url")
          .eq("id", profile.school_id)
          .single();

        if (schoolError) throw schoolError;
        
        setSchool(schoolData);
        setSchoolName(schoolData.school_name);
        setPreviewUrl(schoolData.logo_url);
      }
    } catch (error: any) {
      console.error("Error fetching school:", error);
      toast.error("Failed to load school settings");
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !school) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size must be less than 2MB");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${school.id}.${fileExt}`;
      const filePath = `${fileName}`;

      // Delete old logo if exists
      if (school.logo_url) {
        const oldPath = school.logo_url.split("/").pop();
        if (oldPath) {
          await supabase.storage.from("school-logos").remove([oldPath]);
        }
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from("school-logos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("school-logos")
        .getPublicUrl(filePath);

      const logoUrl = urlData.publicUrl;

      // Update school record
      const { error: updateError } = await supabase
        .from("schools")
        .update({ logo_url: logoUrl })
        .eq("id", school.id);

      if (updateError) throw updateError;

      setPreviewUrl(logoUrl);
      setSchool({ ...school, logo_url: logoUrl });
      toast.success("School logo updated successfully");
    } catch (error: any) {
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
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word[0])
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

  if (!school) {
    return (
      <div className="text-center py-8">
        <Building className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No school associated with your account</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">School Settings</h1>
        <p className="text-muted-foreground">
          Manage your school's information and branding
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              School Logo
            </CardTitle>
            <CardDescription>
              Upload a custom logo or badge for your school
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24 border-2 border-border">
                <AvatarImage src={previewUrl || undefined} alt={school.school_name} />
                <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-accent text-white">
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
                <p className="text-xs text-muted-foreground">
                  Recommended: Square image, max 2MB
                </p>
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
            <CardDescription>
              Update your school's name and details
            </CardDescription>
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
              <p className="text-xs text-muted-foreground">
                School code cannot be changed
              </p>
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
  );
};

export default SchoolSettings;
