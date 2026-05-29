import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/report/hooks/use-auth";
import { useSchool, useSchoolSettings } from "@/report/hooks/use-school-data";
import { resolveUserSchoolId } from "@/lib/schoolFetch";
import { PageHeader } from "@/report/portal/page-header";
import { TermsManager } from "@/report/components/terms-manager";
import { SignatureManager } from "@/report/portal/signature-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { GradingFormat } from "@/report/lib/grading";
import { Loader2, Upload } from "lucide-react";
import { withReportLayout } from "@/report/withReportLayout";
import { ReportThemeColorPicker } from "@/report/components/report-theme-color-picker";
import {
  DEFAULT_REPORT_THEME,
  isValidHexColor,
  resolveReportThemePrimary,
} from "@/report/lib/report-brand-colors";
import { parseSchoolBrand } from "@/lib/themeColors";
import { validateReportImageFile } from "@/report/lib/validate-report-upload";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";

function ReportSettingsPage() {
  const { profile, user } = useAuth();
  const { data: school, refetch: refetchSchool } = useSchool();
  const { data: settings } = useSchoolSettings();
  const qc = useQueryClient();

  const [branding, setBranding] = useState({
    name: "",
    motto: "",
    address: "",
    phone: "",
    email: "",
    principal_name: "",
    logo_url: "",
    stamp_url: "",
  });
  const [uploading, setUploading] = useState<"logo" | "stamp" | null>(null);

  const [grading, setGrading] = useState({
    ca_weight: 0.4,
    exam_weight: 0.6,
    pass_mark: 40,
    alert_drop_threshold: 15,
    auto_remarks: true,
    grading_system: "letter" as GradingFormat,
    report_theme_primary: DEFAULT_REPORT_THEME,
    report_card_footer: "",
  });

  useEffect(() => {
    if (school) {
      setBranding({
        name: (school.name as string) ?? "",
        motto: (school.motto as string) ?? "",
        address: (school.address as string) ?? "",
        phone: (school.phone as string) ?? "",
        email: (school.email as string) ?? "",
        principal_name: (school.principal_name as string) ?? "",
        logo_url: (school.logo_url as string) ?? "",
        stamp_url: (school.stamp_url as string) ?? "",
      });
    }
  }, [school]);

  useEffect(() => {
    if (settings || school) {
      const schoolPrimary = parseSchoolBrand(
        school as { theme_primary?: string | null; theme_secondary?: string | null; theme_accent?: string | null } | null,
      ).primary;
      setGrading((prev) => ({
        ...prev,
        ...(settings
          ? {
              ca_weight: Number(settings.ca_weight),
              exam_weight: Number(settings.exam_weight),
              pass_mark: Number(settings.pass_mark),
              alert_drop_threshold: Number(settings.alert_drop_threshold),
              auto_remarks: settings.auto_remarks ?? true,
              grading_system:
                (settings as { grading_system?: string }).grading_system === "numeric"
                  ? "numeric"
                  : "letter",
              report_card_footer: (settings as { report_card_footer?: string }).report_card_footer ?? "",
            }
          : {}),
        report_theme_primary: resolveReportThemePrimary(
          (settings as { report_theme_primary?: string } | null | undefined)?.report_theme_primary,
          schoolPrimary,
        ),
      }));
    }
  }, [settings, school]);

  const saveBranding = useMutation({
    mutationFn: async () => {
      const schoolId = school?.id ?? profile?.school_id ?? (user ? await resolveUserSchoolId(user.id) : null);
      if (!schoolId) throw new Error("No school linked to your account");
      const { error } = await supabase
        .from("schools")
        .update({
          name: branding.name,
          school_name: branding.name,
          motto: branding.motto || null,
          address: branding.address || null,
          phone: branding.phone || null,
          email: branding.email || null,
          principal_name: branding.principal_name || null,
          logo_url: branding.logo_url || null,
          stamp_url: branding.stamp_url || null,
        } as never)
        .eq("id", schoolId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchSchool();
      toast.success("Report branding saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveGrading = useMutation({
    mutationFn: async () => {
      const schoolId = school?.id ?? profile?.school_id ?? (user ? await resolveUserSchoolId(user.id) : null);
      if (!schoolId) throw new Error("No school linked to your account");
      const payload = {
        school_id: schoolId,
        ca_weight: grading.ca_weight,
        exam_weight: grading.exam_weight,
        pass_mark: grading.pass_mark,
        alert_drop_threshold: grading.alert_drop_threshold,
        auto_remarks: grading.auto_remarks,
        grading_system: grading.grading_system,
        report_theme_primary: isValidHexColor(grading.report_theme_primary)
          ? grading.report_theme_primary
          : DEFAULT_REPORT_THEME,
        report_card_footer: grading.report_card_footer.trim() || null,
      };
      if (settings?.id) {
        const { error } = await supabase.from("school_settings").update(payload).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("school_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["school-settings"] });
      qc.invalidateQueries({ queryKey: ["report-theme"] });
      toast.success("Grading & report theme saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleImageUpload = async (kind: "logo" | "stamp", file: File) => {
    const schoolId = school?.id ?? profile?.school_id ?? (user ? await resolveUserSchoolId(user.id) : null);
    if (!file || !schoolId) return;
    const validationError = validateReportImageFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${schoolId}/${kind}-${Date.now()}.${ext}`;
      const bucket = "school-assets";
      let { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (upErr?.message?.includes("Bucket not found")) {
        const fallbackPath = `${schoolId}-${kind}-${Date.now()}.${ext}`;
        ({ error: upErr } = await supabase.storage
          .from("school-logos")
          .upload(fallbackPath, file, { upsert: true }));
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("school-logos").getPublicUrl(fallbackPath);
        setBranding((b) => ({ ...b, [`${kind}_url`]: pub.publicUrl }));
      } else {
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
        setBranding((b) => ({ ...b, [`${kind}_url`]: pub.publicUrl }));
      }
      toast.success(`${kind === "logo" ? "Logo" : "Stamp"} uploaded`);
      saveBranding.mutate();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(null);
    }
  };

  const weightTotal = Math.round((grading.ca_weight + grading.exam_weight) * 100);

  return (
    <>
      <PageHeader
        title="Report settings"
        description="Grading system, academic terms, report card branding, and signatures."
      />
      <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Report card branding</CardTitle>
            <CardDescription>
              Identity information shown on printed and PDF report cards. You can also edit motto,
              location, contacts, and email under{" "}
              <Link to="/admin/school-settings" className="text-primary underline">
                School Settings → Report card details
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>School name</Label>
                <Input value={branding.name} onChange={(e) => setBranding({ ...branding, name: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Motto</Label>
                <Input value={branding.motto} onChange={(e) => setBranding({ ...branding, motto: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Address</Label>
                <Input value={branding.address} onChange={(e) => setBranding({ ...branding, address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={branding.phone} onChange={(e) => setBranding({ ...branding, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={branding.email} onChange={(e) => setBranding({ ...branding, email: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Principal / headmaster name</Label>
                <Input
                  value={branding.principal_name}
                  onChange={(e) => setBranding({ ...branding, principal_name: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6 pt-2">
              {(["logo", "stamp"] as const).map((kind) => (
                <div key={kind} className="space-y-2">
                  <Label className="capitalize">{kind}</Label>
                  {branding[`${kind}_url`] && (
                    <img
                      src={branding[`${kind}_url`]}
                      alt={kind}
                      className="h-20 max-w-[160px] rounded border bg-white object-contain p-1"
                    />
                  )}
                  <Button variant="outline" size="sm" disabled={!!uploading} asChild>
                    <label className="cursor-pointer">
                      {uploading === kind ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-1 h-4 w-4" />
                      )}
                      Upload {kind}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleImageUpload(kind, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </Button>
                </div>
              ))}
            </div>

            <Button onClick={() => saveBranding.mutate()} disabled={saveBranding.isPending}>
              {saveBranding.isPending ? "Saving…" : "Save branding"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Report card theme</CardTitle>
            <CardDescription>
              Primary color for headers, tables, borders, and highlights on all report cards (print &amp;
              PDF). By default this matches your school brand primary from{" "}
              <strong>School Settings → Brand Colors</strong>. Change it here only if you want a different
              color on reports than the rest of the portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReportThemeColorPicker
              value={grading.report_theme_primary}
              onChange={(hex) => setGrading({ ...grading, report_theme_primary: hex })}
              disabled={saveGrading.isPending}
            />
            <div className="space-y-2">
              <Label>Report footer note (optional)</Label>
              <Textarea
                rows={2}
                placeholder="Confidential — for the named learner and their guardian."
                value={grading.report_card_footer}
                onChange={(e) => setGrading({ ...grading, report_card_footer: e.target.value })}
              />
            </div>
            <Button
              onClick={() => saveGrading.mutate()}
              disabled={saveGrading.isPending || !isValidHexColor(grading.report_theme_primary)}
            >
              {saveGrading.isPending ? "Saving…" : "Save theme"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Grading &amp; alerts</CardTitle>
            <CardDescription>Configure score weights, pass marks, and report card grade format.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Grading format</Label>
              <Select
                value={grading.grading_system}
                onValueChange={(v) => setGrading({ ...grading, grading_system: v as GradingFormat })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="letter">Letter grades (A, B+, C, …)</SelectItem>
                  <SelectItem value="numeric">Numeric grades (1, 2, 3 — 1 is highest)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Applies to report cards, score entry, and positions.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Score weights</Label>
                <span className={`text-sm font-medium ${weightTotal === 100 ? "text-primary" : "text-destructive"}`}>
                  {weightTotal}% total
                </span>
              </div>
              {(["ca_weight", "exam_weight"] as const).map((key) => (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{key === "ca_weight" ? "Continuous Assessment (CA)" : "End-of-Term Exam"}</span>
                    <span>{Math.round(grading[key] * 100)}%</span>
                  </div>
                  <Slider
                    min={0}
                    max={1}
                    step={0.05}
                    value={[grading[key]]}
                    onValueChange={([v]) => setGrading({ ...grading, [key]: v })}
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Pass mark</Label>
                <Input
                  type="number"
                  value={grading.pass_mark}
                  onChange={(e) => setGrading({ ...grading, pass_mark: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Alert drop threshold (%)</Label>
                <Input
                  type="number"
                  value={grading.alert_drop_threshold}
                  onChange={(e) => setGrading({ ...grading, alert_drop_threshold: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium text-sm">Auto-generate remarks</p>
                <p className="text-xs text-muted-foreground">Add teacher remarks based on performance tiers</p>
              </div>
              <Switch
                checked={grading.auto_remarks}
                onCheckedChange={(v) => setGrading({ ...grading, auto_remarks: v })}
              />
            </div>

            <Button onClick={() => saveGrading.mutate()} disabled={saveGrading.isPending}>
              {saveGrading.isPending ? "Saving…" : "Save grading settings"}
            </Button>
          </CardContent>
        </Card>

        <TermsManager />

        <SignatureManager
          roleKind="school_admin"
          title="Headmaster signature"
          description="Upload and manage signatures shown in the Headmaster Signature field on report cards."
        />
      </div>
    </>
  );
}

export default withReportLayout("admin", ReportSettingsPage);
