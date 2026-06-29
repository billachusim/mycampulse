import { supabase } from "@/integrations/supabase/client";

const BUCKET = "campus-media";
// 10 years — effectively permanent for our use.
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 365 * 10;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function uploadImage(file: File, folder: "events" | "listings" | "avatars" | "posts"): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("You must be signed in to upload.");
  if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image must be 5MB or smaller.");

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${uid}/${folder}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type,
  });
  if (upErr) throw upErr;

  const { data: signed, error: sErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_EXPIRY);
  if (sErr || !signed) throw sErr ?? new Error("Could not generate image URL.");
  return signed.signedUrl;
}
