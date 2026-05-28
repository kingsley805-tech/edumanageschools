import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/report/hooks/use-auth";
import {
  deleteUserSignature,
  fetchUserSignatures,
  setActiveUserSignature,
  uploadUserSignature,
  type SignatureRoleKind,
  type UserSignature,
} from "@/report/lib/user-signatures";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PenLine, Star, Trash2, Upload } from "lucide-react";
import { validateReportImageFile } from "@/report/lib/validate-report-upload";

type Props = {
  roleKind: SignatureRoleKind;
  title: string;
  description: string;
};

export function SignatureManager({ roleKind, title, description }: Props) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const schoolId = profile?.school_id ?? "";
  const userId = user?.id ?? "";
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: signatures, isLoading } = useQuery({
    queryKey: ["user-signatures", userId, roleKind],
    enabled: !!userId,
    queryFn: () => fetchUserSignatures(userId, roleKind),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["user-signatures", userId, roleKind] });
    qc.invalidateQueries({ queryKey: ["active-signature"] });
  };

  const onUpload = async (file: File) => {
    if (!userId || !schoolId) {
      toast.error("Your account must be linked to a school before uploading a signature.");
      return;
    }
    const validationError = validateReportImageFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setUploading(true);
    try {
      await uploadUserSignature({
        userId,
        schoolId,
        roleKind,
        label: label || "Default",
        file,
        setActive: true,
      });
      setLabel("");
      invalidate();
      toast.success("Signature uploaded and set as active");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const activate = useMutation({
    mutationFn: (id: string) => setActiveUserSignature(id, userId),
    onSuccess: () => {
      invalidate();
      toast.success("Active signature updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteUserSignature(id, userId),
    onSuccess: () => {
      invalidate();
      toast.success("Signature removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base flex items-center gap-2">
          <PenLine className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 flex-1 min-w-[140px]">
            <Label>Label (optional)</Label>
            <Input
              placeholder="e.g. Official"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div>
            <Label className="sr-only">Upload</Label>
            <Button asChild disabled={uploading || !schoolId} variant="outline">
              <label className="cursor-pointer flex items-center gap-2">
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading…" : "Upload signature"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onUpload(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          PNG or JPG on white/transparent background works best. The active signature appears on report cards.
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading signatures…</p>
        ) : !signatures?.length ? (
          <p className="text-sm text-muted-foreground">No signatures yet. Upload one to use on report cards.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {signatures.map((sig: UserSignature) => (
              <li key={sig.id} className="flex flex-wrap items-center gap-3 p-3">
                <img
                  src={sig.image_url}
                  alt={sig.label}
                  className="h-12 max-w-[140px] object-contain bg-white rounded border"
                />
                <div className="flex-1 min-w-[120px]">
                  <p className="font-medium text-sm">{sig.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(sig.created_at).toLocaleDateString()}
                  </p>
                </div>
                {sig.is_active ? (
                  <Badge className="bg-primary text-primary-foreground">Active</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => activate.mutate(sig.id)}
                    disabled={activate.isPending}
                  >
                    <Star className="mr-1 h-3.5 w-3.5" />
                    Set active
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => remove.mutate(sig.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
