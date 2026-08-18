import { supabase } from "@/integrations/supabase/client";

const BUCKET = "achievement-media";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const DOC_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DOC_BYTES = 10 * 1024 * 1024;

function extFromFile(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName) return fromName;
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "application/pdf") return "pdf";
  return "bin";
}

export async function uploadAchievementMedia(params: {
  schoolId: string;
  file: File;
  achievementId?: string;
  kind: "image" | "document";
}): Promise<string> {
  const isImage = params.kind === "image";
  const allowed = isImage ? IMAGE_TYPES : DOC_TYPES;
  const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_DOC_BYTES;

  if (!allowed.has(params.file.type)) {
    throw new Error(
      isImage
        ? "Please upload a JPG, PNG, WebP, or GIF image."
        : "Please upload a PDF or Word document.",
    );
  }
  if (params.file.size > maxBytes) {
    throw new Error(isImage ? "Image must be 5 MB or smaller." : "Document must be 10 MB or smaller.");
  }

  const folder = isImage ? "images" : "documents";
  const fileName = `${params.achievementId ?? crypto.randomUUID()}-${Date.now()}.${extFromFile(params.file)}`;
  const path = `${params.schoolId}/${folder}/${fileName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, params.file, {
    upsert: false,
    contentType: params.file.type,
  });
  if (error) {
    const msg = error.message || "Upload failed";
    if (/bucket|not found|row-level security|mime/i.test(msg)) {
      throw new Error(
        `${msg} — run public/sql/apply-achievement-media.sql in Supabase, then retry.`,
      );
    }
    throw error;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
