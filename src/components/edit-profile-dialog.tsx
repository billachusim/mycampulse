import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { updateMyProfile } from "@/lib/profile.functions";
import { initials } from "@/lib/profile";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const AVATARS_BUCKET = "avatars";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // ~10 years

async function downscaleToSquare(file: File, size = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const s = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - s) / 2;
  const sy = (bitmap.height - s) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, sx, sy, s, s, 0, 0, size, size);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode image"))),
      "image/jpeg",
      0.88,
    ),
  );
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

export function EditProfileDialog({ open, onOpenChange, userId, displayName, bio, avatarUrl }: Props) {
  const qc = useQueryClient();
  const save = useServerFn(updateMyProfile);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(displayName ?? "");
  const [bioText, setBio] = useState(bio ?? "");
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Display name is required");
      if (trimmed.length > 60) throw new Error("Display name must be under 60 characters");
      if (bioText.length > 240) throw new Error("Bio must be under 240 characters");

      let newAvatarUrl: string | undefined;
      if (pendingBlob) {
        const path = `${userId}/${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from(AVATARS_BUCKET)
          .upload(path, pendingBlob, { contentType: "image/jpeg", upsert: true });
        if (upErr) throw new Error(upErr.message);
        const { data: signed, error: sErr } = await supabase.storage
          .from(AVATARS_BUCKET)
          .createSignedUrl(path, SIGNED_URL_TTL);
        if (sErr || !signed) throw new Error(sErr?.message ?? "Could not sign avatar URL");
        newAvatarUrl = signed.signedUrl;
      }

      await save({
        data: {
          display_name: trimmed,
          bio: bioText.trim() ? bioText.trim() : null,
          ...(newAvatarUrl ? { avatar_url: newAvatarUrl } : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile-page", userId] });
      qc.invalidateQueries({ queryKey: ["profile", userId] });
      qc.invalidateQueries({ queryKey: ["me-profile"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error("Use JPG, PNG, or WebP");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image too large (max 8 MB)");
      return;
    }
    try {
      const blob = await downscaleToSquare(file, 512);
      setPendingBlob(blob);
      setPreview(URL.createObjectURL(blob));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={preview ?? undefined} />
              <AvatarFallback className="bg-secondary text-lg">{initials(name)}</AvatarFallback>
            </Avatar>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onFile}
              />
              <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                Change photo
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP · auto-cropped to a square</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Display name</Label>
            <Input
              id="edit-name"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-bio">Bio</Label>
            <Textarea
              id="edit-bio"
              value={bioText}
              maxLength={240}
              rows={3}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A short line about you"
            />
            <p className="text-right text-xs text-muted-foreground">{bioText.length}/240</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="brand-gradient text-primary-foreground"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
