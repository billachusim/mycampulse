import { useRef, useState } from "react";
import { ImagePlus, Loader2, X, Film, ImageIcon } from "lucide-react";
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
  const [progress, setProgress] = useState(0);
  const [kind, setKind] = useState<"image" | "video" | null>(null);

  async function handle(file: File) {
    setBusy(true);
    setProgress(0);
    setKind(file.type.startsWith("video/") ? "video" : "image");
    const loadingId = toast.loading(
      file.type.startsWith("video/") ? "Uploading video…" : "Uploading photo…",
      { description: "0%" }
    );
    try {
      const media = await uploadMedia(file, folder, (pct) => {
        setProgress(pct);
        toast.loading(file.type.startsWith("video/") ? "Uploading video…" : "Uploading photo…", {
          id: loadingId,
          description: `${pct}%`,
        });
      });
      onChange(media);
      toast.success(media.type === "video" ? "Video ready to post" : "Photo ready to post", {
        id: loadingId,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed", { id: loadingId });
    } finally {
      setBusy(false);
      setProgress(0);
      setKind(null);
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

  if (busy) {
    const Icon = kind === "video" ? Film : ImageIcon;
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-card/50 p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 text-foreground">
          <Icon className="h-5 w-5" />
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Uploading {kind === "video" ? "video" : "photo"}… {progress}%</span>
        </div>
        <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-[width] duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/60 bg-card/50 text-sm text-muted-foreground transition hover:border-primary/60 hover:bg-card"
    >
      <ImagePlus className="h-6 w-6" />
      <span>{label}</span>
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
