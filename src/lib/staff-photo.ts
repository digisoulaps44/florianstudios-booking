/** Medarbejderfotos: kvadratisk beskæring + komprimering i browseren, upload til bucket `staff-photos`. */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const STAFF_PHOTO_BUCKET = "staff-photos";
export const STAFF_PHOTO_SIZE = 512;

/** Bucket'en er privat: signerede URL'er gælder 1 time. */
export const STAFF_PHOTO_URL_TTL_SECONDS = 3600;

/** Signeret URL til et foto for en logget-ind bruger (appen). Fornyes før udløb. */
export function useStaffPhotoUrl(path: string | null | undefined): string | undefined {
  const q = useQuery({
    queryKey: ["staff-photo-url", path],
    enabled: !!path,
    staleTime: (STAFF_PHOTO_URL_TTL_SECONDS - 600) * 1000,
    refetchInterval: (STAFF_PHOTO_URL_TTL_SECONDS - 600) * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(STAFF_PHOTO_BUCKET)
        .createSignedUrl(path!, STAFF_PHOTO_URL_TTL_SECONDS);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  return path ? q.data : undefined;
}

/** Midterste kvadrat af kildebilledet (ren matematik – testbar). */
export function centerSquare(width: number, height: number) {
  const side = Math.min(width, height);
  return { sx: Math.round((width - side) / 2), sy: Math.round((height - side) / 2), side };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Beskærer til kvadrat og skalerer ned til højst 512 px. WebP, ellers JPEG (ældre Safari). */
export async function compressSquare(file: File): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  if (!file.type.startsWith("image/")) throw new Error("not_image");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { sx, sy, side } = centerSquare(bitmap.width, bitmap.height);
  const out = Math.min(STAFF_PHOTO_SIZE, side);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no_canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
  bitmap.close();
  const webp = await toBlob(canvas, "image/webp", 0.82);
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  const jpg = await toBlob(canvas, "image/jpeg", 0.85);
  if (!jpg) throw new Error("encode_failed");
  return { blob: jpg, ext: "jpg" };
}

/** Uploader nyt foto, gemmer stien på medarbejderen og sletter det gamle. */
export async function uploadStaffPhoto(staffId: string, file: File, oldPath: string | null) {
  const { blob, ext } = await compressSquare(file);
  const path = `${staffId}/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage
    .from(STAFF_PHOTO_BUCKET)
    .upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
  if (up.error) throw up.error;
  const { error } = await supabase.from("staff").update({ photo_path: path }).eq("id", staffId);
  if (error) {
    await supabase.storage.from(STAFF_PHOTO_BUCKET).remove([path]);
    throw error;
  }
  if (oldPath) await supabase.storage.from(STAFF_PHOTO_BUCKET).remove([oldPath]);
  return path;
}

export async function removeStaffPhoto(staffId: string, path: string) {
  const { error } = await supabase.from("staff").update({ photo_path: null }).eq("id", staffId);
  if (error) throw error;
  await supabase.storage.from(STAFF_PHOTO_BUCKET).remove([path]);
}
