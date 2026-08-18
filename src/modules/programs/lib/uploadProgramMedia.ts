import { supabase } from "@/integrations/supabase/client";

const BUCKET = "program-media";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

function extFromFile(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName) return fromName;
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "video/quicktime") return "mov";
  if (file.type.startsWith("video/")) return file.type.split("/")[1] ?? "mp4";
  return "bin";
}

export async function uploadProgramMedia(params: {
  schoolId: string;
  file: File;
  programId?: string;
  kind: "image" | "video";
}): Promise<string> {
  const isVideo = params.kind === "video";
  const allowed = isVideo ? VIDEO_TYPES : IMAGE_TYPES;
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

  if (!allowed.has(params.file.type)) {
    throw new Error(
      isVideo
        ? "Please upload MP4, WebM, MOV, or AVI video."
        : "Please upload a JPG, PNG, WebP, or GIF image.",
    );
  }
  if (params.file.size > maxBytes) {
    throw new Error(isVideo ? "Video must be 50 MB or smaller." : "Image must be 5 MB or smaller.");
  }

  const folder = isVideo ? "videos" : "images";
  const fileName = `${params.programId ?? crypto.randomUUID()}-${Date.now()}.${extFromFile(params.file)}`;
  const path = `${params.schoolId}/${folder}/${fileName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, params.file, {
    upsert: false,
    contentType: params.file.type,
  });
  if (error) {
    const msg = error.message || "Upload failed";
    if (/bucket|not found|row-level security|mime/i.test(msg)) {
      throw new Error(
        `${msg} — run public/sql/apply-program-media.sql in Supabase, then retry.`,
      );
    }
    throw error;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|avi)(\?|$)/i.test(url) || url.includes("/videos/");
}
