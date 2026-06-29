import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { uploadImage } from "@/lib/upload";
import { toast } from "sonner";

export function ImageUploader({
  value,
  onChange,
  folder,
  aspect = "video",
  label = "Add a photo",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  folder: "events" | "listings" | "avatars" | "posts";
  aspect?: "video" | "square";
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(file: File) {
    setBusy(true);
    try {
      const url = await uploadImage(file, folder);
      onChange(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const ratio = aspect === "square" ? "aspect-square" : "aspect-video";

  if (value) {
    return (
      <div className={`relative ${ratio} w-full overflow-hidden rounded-2xl border border-border/60 bg-muted`}>
        <img src={value} alt="" className="h-full w-full object-cover" />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
          aria-label="Remove image"
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
      className={`flex ${ratio} w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/60 bg-card/50 text-sm text-muted-foreground transition hover:border-primary/60 hover:bg-card`}
      disabled={busy}
    >
      {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
      <span>{busy ? "Uploading…" : label}</span>
      <span className="text-[11px]">JPG / PNG / WEBP · max 5MB</span>
      <input
        ref={ref}
        type="file"
        accept="image/*"
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
