import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUploader } from "@/components/image-uploader";
import { useProfile } from "@/lib/profile";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/events/new")({
  component: NewEventPage,
});

const schema = z.object({
  title: z.string().trim().min(4, "Give it a clear title").max(120),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(160).optional(),
  starts_at: z.string().min(1, "Pick a start time"),
  ends_at: z.string().optional(),
  cover_url: z.string().url().nullable(),
  community_id: z.string().nullable(),
});

function NewEventPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [communityId, setCommunityId] = useState<string>("none");

  const { data: communities = [] } = useQuery({
    queryKey: ["my-communities", profile?.primary_school_id],
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
      if (!profile?.id) throw new Error("Sign in first");
      if (!profile.primary_school_id) throw new Error("Pick a primary school in onboarding first");
      const parsed = schema.parse({
        title,
        description: description || undefined,
        location: location || undefined,
        starts_at: startsAt ? new Date(startsAt).toISOString() : "",
        ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
        cover_url: coverUrl,
        community_id: communityId === "none" ? null : communityId,
      });
      const { data, error } = await supabase
        .from("events")
        .insert({
          host_id: profile.id,
          school_id: profile.primary_school_id,
          community_id: parsed.community_id,
          title: parsed.title,
          description: parsed.description ?? null,
          location: parsed.location ?? null,
          starts_at: parsed.starts_at,
          ends_at: parsed.ends_at ?? null,
          cover_url: parsed.cover_url,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Event published · +15 Campoints 🎉");
      qc.invalidateQueries({ queryKey: ["events-all"] });
      qc.invalidateQueries({ queryKey: ["events-rail"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      navigate({ to: "/events" });
    },
    onError: (e: unknown) => {
      const msg = e instanceof z.ZodError ? e.issues[0]?.message : e instanceof Error ? e.message : "Could not create event";
      toast.error(msg ?? "Could not create event");
    },
  });

  return (
    <AppShell>
      <div className="mb-5 flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
        <CalendarDays className="h-4 w-4" /> New event
      </div>
      <h1 className="mb-1 font-display text-3xl">Host something on campus</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Any student can host. Free for students. You earn +15 Campoints per event (max 2/day).
      </p>

      <div className="space-y-5 rounded-3xl border border-border/60 bg-card p-5">
        <ImageUploader value={coverUrl} onChange={setCoverUrl} folder="events" label="Add cover photo (optional)" />

        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. UNILAG Tech Fest 2026" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="starts_at">Starts</Label>
            <Input id="starts_at" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ends_at">Ends (optional)</Label>
            <Input id="ends_at" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
        </div>

        <div>
          <Label htmlFor="location">Location</Label>
          <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Multipurpose Hall, UNILAG" maxLength={160} />
        </div>

        <div>
          <Label htmlFor="desc">Description</Label>
          <Textarea id="desc" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's the event about? Speakers, agenda, who should come…" maxLength={2000} />
        </div>

        <div>
          <Label>Community (optional)</Label>
          <Select value={communityId} onValueChange={setCommunityId}>
            <SelectTrigger className="bg-secondary"><SelectValue placeholder="Choose a community" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">📣 Whole school</SelectItem>
              {communities.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => navigate({ to: "/events" })}>Cancel</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !title.trim() || !startsAt}
            className="brand-gradient text-primary-foreground"
          >
            {create.isPending ? "Publishing…" : "Publish event"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
