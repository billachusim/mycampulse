import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { uploadMedia, type UploadedMedia } from "@/lib/upload";
import { toast } from "sonner";

export function MediaUploader({
  value,
  onChange,
  folder,
  label = "Add a photo or video",
}: {
  value: UploadedMedia | null;
  onChange: (media: UploadedMedia | null) => void;
  folder: "events" | "listings" | "avatars" | "posts";
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(file: File) {
    setBusy(true);
    try {
      const media = await uploadMedia(file, folder);
      onChange(media);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  if (value) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-muted">
        {value.type === "video" ? (
          <video src={value.url} controls playsInline className="h-full w-full object-cover" />
        ) : (
          <img src={value.url} alt="" className="h-full w-full object-cover" />
        )}
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
          aria-label="Remove media"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/60 bg-card/50 text-sm text-muted-foreground transition hover:border-primary/60 hover:bg-card"
      disabled={busy}
    >
      {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
      <span>{busy ? "Uploading…" : label}</span>
      <span className="text-[11px]">Photo up to 5MB · Video up to 50MB</span>
      <input
        ref={ref}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
          e.target.value = "";
        }}
      />
    </button>
  );
}
