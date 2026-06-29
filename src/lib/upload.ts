import { supabase } from "@/integrations/supabase/client";

const BUCKET = "campus-media";
// 10 years — effectively permanent for our use.
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 365 * 10;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export type UploadedMedia = { type: "image" | "video"; url: string };

type Folder = "events" | "listings" | "avatars" | "posts";

export class UploadCancelledError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "UploadCancelledError";
  }
}

export type UploadOptions = {
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
};

function putWithProgress(url: string, file: File, opts: UploadOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) opts.onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new UploadCancelledError());
    if (opts.signal) {
      if (opts.signal.aborted) {
        xhr.abort();
      } else {
        opts.signal.addEventListener("abort", () => xhr.abort(), { once: true });
      }
    }
    xhr.send(file);
  });
}

async function uploadToBucket(file: File, folder: Folder, fallbackExt: string, opts: UploadOptions = {}): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("You must be signed in to upload.");

  const ext = (file.name.split(".").pop() ?? fallbackExt).toLowerCase().replace(/[^a-z0-9]/g, "") || fallbackExt;
  const path = `${uid}/${folder}/${crypto.randomUUID()}.${ext}`;

  if (opts.signal?.aborted) throw new UploadCancelledError();

  const { data: signedUpload, error: signErr } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (signErr || !signedUpload) throw signErr ?? new Error("Could not start upload.");

  try {
    await putWithProgress(signedUpload.signedUrl, file, opts);
  } catch (err) {
    // Clean up any partial object so we don't leak storage.
    supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw err;
  }

  if (opts.signal?.aborted) {
    supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw new UploadCancelledError();
  }

  const { data: signed, error: sErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_EXPIRY);
  if (sErr || !signed) throw sErr ?? new Error("Could not generate media URL.");
  return signed.signedUrl;
}

export async function uploadImage(file: File, folder: Folder, onProgress?: (pct: number) => void): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image must be 5MB or smaller.");
  return uploadToBucket(file, folder, "jpg", { onProgress });
}

export async function uploadMedia(file: File, folder: Folder, opts: UploadOptions = {}): Promise<UploadedMedia> {
  if (file.type.startsWith("image/")) {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image must be 5MB or smaller.");
    const url = await uploadToBucket(file, folder, "jpg", opts);
    return { type: "image", url };
  }
  if (file.type.startsWith("video/")) {
    if (file.size > MAX_VIDEO_BYTES) throw new Error("Video must be 50MB or smaller.");
    const url = await uploadToBucket(file, folder, "mp4", opts);
    return { type: "video", url };
  }
  throw new Error("Only images or videos are allowed.");
}
