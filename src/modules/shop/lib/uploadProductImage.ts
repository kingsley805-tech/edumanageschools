import { supabase } from "@/integrations/supabase/client";

const BUCKET = "shop-products";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function uploadShopProductImage(params: {
  schoolId: string;
  file: File;
  productId?: string;
}): Promise<string> {
  if (!ALLOWED.has(params.file.type)) {
    throw new Error("Please upload a JPG, PNG, WebP, or GIF image.");
  }
  if (params.file.size > MAX_BYTES) {
    throw new Error("Image must be 5 MB or smaller.");
  }

  const ext = params.file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpeg", "jpg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
  const fileName = `${params.productId ?? crypto.randomUUID()}.${safeExt === "jpeg" ? "jpg" : safeExt}`;
  const path = `${params.schoolId}/${fileName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, params.file, {
    upsert: true,
    contentType: params.file.type,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
