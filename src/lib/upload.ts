import { supabase } from "@/integrations/supabase/client";

const BUCKET = "campus-media";
// 10 years — effectively permanent for our use.
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 365 * 10;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export type UploadedMedia = { type: "image" | "video"; url: string };

type Folder = "events" | "listings" | "avatars" | "posts";

async function uploadToBucket(file: File, folder: Folder, fallbackExt: string): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("You must be signed in to upload.");

  const ext = (file.name.split(".").pop() ?? fallbackExt).toLowerCase().replace(/[^a-z0-9]/g, "") || fallbackExt;
  const path = `${uid}/${folder}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type,
  });
  if (upErr) throw upErr;

  const { data: signed, error: sErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_EXPIRY);
  if (sErr || !signed) throw sErr ?? new Error("Could not generate media URL.");
  return signed.signedUrl;
}

export async function uploadImage(file: File, folder: Folder): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image must be 5MB or smaller.");
  return uploadToBucket(file, folder, "jpg");
}

export async function uploadMedia(file: File, folder: Folder): Promise<UploadedMedia> {
  if (file.type.startsWith("image/")) {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image must be 5MB or smaller.");
    const url = await uploadToBucket(file, folder, "jpg");
    return { type: "image", url };
  }
  if (file.type.startsWith("video/")) {
    if (file.size > MAX_VIDEO_BYTES) throw new Error("Video must be 50MB or smaller.");
    const url = await uploadToBucket(file, folder, "mp4");
    return { type: "video", url };
  }
  throw new Error("Only images or videos are allowed.");
}
