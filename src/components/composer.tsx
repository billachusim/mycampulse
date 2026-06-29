import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MediaUploader } from "@/components/media-uploader";
import type { UploadedMedia } from "@/lib/upload";
import { toast } from "sonner";

export function Composer({ open, onOpenChange, defaultCommunityId }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCommunityId?: string;
}) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<UploadedMedia | null>(null);
  const [communityId, setCommunityId] = useState<string>(defaultCommunityId ?? "school");

  const { data: communities = [] } = useQuery({
    queryKey: ["my-communities", profile?.id],
    enabled: !!profile?.primary_school_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communities")
        .select("id, name, kind")
        .eq("school_id", profile!.primary_school_id!)
        .order("kind");
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!profile?.id || !profile.primary_school_id) throw new Error("Finish onboarding first");
      const mediaPayload = media ? [{ type: media.type, url: media.url }] : [];
      const payload = {
        author_id: profile.id,
        school_id: profile.primary_school_id,
        community_id: communityId === "school" ? null : communityId,
        body: body.trim(),
        media: mediaPayload,
      };
      const { error } = await supabase.from("posts").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Posted to your campus · +10 Campoints");
      setBody("");
      setMedia(null);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">What's happening on campus?</DialogTitle>
          <DialogDescription className="sr-only">Share an update, photo, or question with your campus.</DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share gist, ask a question, drop a vibe…"
          rows={4}
          className="resize-none border-border/60 bg-background text-base"
        />
        <MediaUploader value={media} onChange={setMedia} folder="posts" label="Add a photo or video (optional)" />
        <div className="flex items-center justify-between gap-3">
          <Select value={communityId} onValueChange={setCommunityId}>
            <SelectTrigger className="w-auto min-w-[10rem] bg-secondary"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="school">📣 Whole school</SelectItem>
              {communities.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {kindEmoji(c.kind)} {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => create.mutate()} disabled={(!body.trim() && !media) || create.isPending} className="brand-gradient text-primary-foreground">
            {create.isPending ? "Posting…" : "Post"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">No categories required — just write. Community moderation keeps things sane.</p>
      </DialogContent>
    </Dialog>
  );
}

function kindEmoji(k: string) {
  return { faculty: "🏛", department: "📚", level: "🎓", hostel: "🏠", club: "✨", sug: "🪪", marketplace: "🛍", events: "📅" }[k] ?? "•";
}
