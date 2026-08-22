import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ExportMenu } from "@/modules/lib/ExportMenu";
import {
  getGradeScale,
  gradingFormatLabel,
  normalizeGradingFormat,
  type GradingFormat,
} from "@/report/lib/grading";
import {
  gradeBandsToScaleRows,
  saveGradingFormat,
  syncGradeScalesForFormat,
} from "@/lib/gradeScales";

interface GradeScale {
  id: string;
  name: string;
  min_score: number;
  max_score: number;
  grade: string;
  grade_point: number | null;
}

const GradeScales = () => {
  const { user } = useAuth();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [gradingFormat, setGradingFormat] = useState<GradingFormat>("letter");
  const [savedFormat, setSavedFormat] = useState<GradingFormat>("letter");
  const [savingFormat, setSavingFormat] = useState(false);
  const [gradeScales, setGradeScales] = useState<GradeScale[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScale, setEditingScale] = useState<GradeScale | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    min_score: 0,
    max_score: 100,
    grade: "",
    grade_point: "",
  });

  const previewBands = getGradeScale(gradingFormat);

  const fetchGradeScales = useCallback(async (sid: string) => {
    const { data, error } = await supabase
      .from("grade_scales")
      .select("*")
      .eq("school_id", sid)
      .order("min_score", { ascending: false });

    if (!error && data) setGradeScales(data);
  }, []);

  const loadPage = useCallback(async () => {
    setLoading(true);
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", currentUser.id)
      .single();

    if (!profileData?.school_id) {
      setLoading(false);
      return;
    }

    setSchoolId(profileData.school_id);

    const { data: settings } = await supabase
      .from("school_settings")
      .select("id, grading_system")
      .eq("school_id", profileData.school_id)
      .maybeSingle();

    const format = normalizeGradingFormat(
      (settings as { grading_system?: string } | null)?.grading_system,
    );
    setSettingsId(settings?.id ?? null);
    setGradingFormat(format);
    setSavedFormat(format);

    await fetchGradeScales(profileData.school_id);
    setLoading(false);
  }, [fetchGradeScales]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const handleApplyFormat = async () => {
    if (!schoolId) return;
    setSavingFormat(true);
    try {
      const { error: settingsError } = await saveGradingFormat(
        schoolId,
        gradingFormat,
        settingsId,
      );
      if (settingsError) throw settingsError;

      const { error: syncError } = await syncGradeScalesForFormat(schoolId, gradingFormat);
      if (syncError) throw syncError;

      if (!settingsId) {
        const { data: settings } = await supabase
          .from("school_settings")
          .select("id")
          .eq("school_id", schoolId)
          .maybeSingle();
        setSettingsId(settings?.id ?? null);
      }

      setSavedFormat(gradingFormat);
      await fetchGradeScales(schoolId);
      toast.success(
        `Grading format set to ${gradingFormatLabel(gradingFormat)}. Report cards and grade entry updated.`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save grading format";
      toast.error(message);
    } finally {
      setSavingFormat(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return;

    const payload = {
      name: formData.name,
      min_score: formData.min_score,
      max_score: formData.max_score,
      grade: formData.grade,
      grade_point: formData.grade_point ? parseFloat(formData.grade_point) : null,
    };

    if (editingScale) {
      const { error } = await supabase.from("grade_scales").update(payload).eq("id", editingScale.id);
      if (error) return toast.error("Failed to update grade scale");
      toast.success("Grade scale updated");
    } else {
      const { error } = await supabase
        .from("grade_scales")
        .insert({ ...payload, school_id: schoolId });
      if (error) return toast.error("Failed to create grade scale");
      toast.success("Grade scale created");
    }
    setDialogOpen(false);
    setEditingScale(null);
    setFormData({ name: "", min_score: 0, max_score: 100, grade: "", grade_point: "" });
    await fetchGradeScales(schoolId);
  };

  const handleEdit = (scale: GradeScale) => {
    setEditingScale(scale);
    setFormData({
      name: scale.name,
      min_score: scale.min_score,
      max_score: scale.max_score,
      grade: scale.grade,
      grade_point: scale.grade_point?.toString() || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!schoolId) return;
    const { error } = await supabase.from("grade_scales").delete().eq("id", id);
    if (error) return toast.error("Failed to delete grade scale");
    toast.success("Grade scale deleted");
    await fetchGradeScales(schoolId);
  };

  const handleResetToStandard = async () => {
    if (!schoolId) return;
    setSavingFormat(true);
    try {
      const { error } = await syncGradeScalesForFormat(schoolId, savedFormat);
      if (error) throw error;
      await fetchGradeScales(schoolId);
      toast.success("Grade scale rows reset to the standard for the current format.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to reset grade scales");
    } finally {
      setSavingFormat(false);
    }
  };

  const formatDirty = gradingFormat !== savedFormat;
  const standardRows = gradeBandsToScaleRows(previewBands);

  return (
    <DashboardLayout role="admin">
      <div className="mingo-content space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-display text-[21px] font-semibold tracking-tight text-foreground">Grade Scales</h2>
            <p className="text-[12.5px] text-muted-foreground mt-1">
              Choose letter or numeric grades and manage score ranges for your school.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Grading format</CardTitle>
            <CardDescription>
              Applies to report cards, teacher grade entry, exam results, and position
              calculations. Current:{" "}
              <Badge variant="secondary">{gradingFormatLabel(savedFormat)}</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label>Grade display type</Label>
                <Select
                  value={gradingFormat}
                  onValueChange={(v) => setGradingFormat(v as GradingFormat)}
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
                  Letter uses A–F. Numeric uses 1–9 where 1 is the best grade.
                </p>
              </div>
              <Button
                onClick={() => void handleApplyFormat()}
                disabled={savingFormat || (!formatDirty && gradeScales.length > 0)}
              >
                {savingFormat ? "Applying…" : formatDirty ? "Apply format" : "Format applied"}
              </Button>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Standard scale preview</p>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Score range</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Remark</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewBands.map((band) => (
                      <TableRow key={band.grade}>
                        <TableCell>{band.range}%</TableCell>
                        <TableCell className="font-semibold">{band.grade}</TableCell>
                        <TableCell>{band.remark}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>School grade scale rows</CardTitle>
              <CardDescription>
                Stored ranges used by exams and grade books. Applying a format reloads these from
                the standard table above.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <ExportMenu
                filename="grade-scales"
                title="School Grade Scales"
                headers={["Remark", "Score range", "Grade", "Grade point"]}
                rows={gradeScales.map((scale) => [
                  scale.name,
                  `${scale.min_score}% – ${scale.max_score}%`,
                  scale.grade,
                  scale.grade_point ?? "—",
                ])}
                disabled={gradeScales.length === 0}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleResetToStandard()}
                disabled={savingFormat || loading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset to standard
              </Button>
              <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                  setDialogOpen(open);
                  if (!open) setEditingScale(null);
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() =>
                      setFormData({
                        name: "",
                        min_score: 0,
                        max_score: 100,
                        grade: "",
                        grade_point: "",
                      })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add row
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingScale ? "Edit" : "Add"} grade scale row</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label>Label / remark</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Excellent"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Min score (%)</Label>
                        <Input
                          type="number"
                          value={formData.min_score}
                          onChange={(e) =>
                            setFormData({ ...formData, min_score: Number(e.target.value) })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>Max score (%)</Label>
                        <Input
                          type="number"
                          value={formData.max_score}
                          onChange={(e) =>
                            setFormData({ ...formData, max_score: Number(e.target.value) })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>
                          Grade ({savedFormat === "numeric" ? "1–9" : "A–F"})
                        </Label>
                        <Input
                          value={formData.grade}
                          onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                          placeholder={savedFormat === "numeric" ? "e.g., 1" : "e.g., A+"}
                          required
                        />
                      </div>
                      <div>
                        <Label>Grade point (optional)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formData.grade_point}
                          onChange={(e) =>
                            setFormData({ ...formData, grade_point: e.target.value })
                          }
                          placeholder="e.g., 4.0"
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full">
                      {editingScale ? "Update" : "Create"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Remark</TableHead>
                  <TableHead>Score range</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Grade point</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gradeScales.map((scale) => (
                  <TableRow key={scale.id}>
                    <TableCell className="font-medium">{scale.name}</TableCell>
                    <TableCell>
                      {scale.min_score}% – {scale.max_score}%
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{scale.grade}</Badge>
                    </TableCell>
                    <TableCell>{scale.grade_point ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(scale)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => void handleDelete(scale.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {gradeScales.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No grade scale rows yet. Choose a format above and click{" "}
                      <strong>Apply format</strong> to load the standard scale.
                      {standardRows.length > 0 && (
                        <span className="block mt-2 text-xs">
                          Or add custom rows with <strong>Add row</strong>.
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default GradeScales;
