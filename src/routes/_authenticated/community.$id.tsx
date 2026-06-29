import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PostCard, POST_SELECT, type FeedPost } from "@/components/post-card";
import { Composer } from "@/components/composer";
import { useAuthUser } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/community/$id")({
  component: CommunityPage,
});

function CommunityPage() {
  const { id } = Route.useParams();
  const { user } = useAuthUser();
  const queryClient = useQueryClient();
  const [composeOpen, setComposeOpen] = useState(false);

  const community = useQuery({
    queryKey: ["community", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("communities").select("*, school:schools(id, short_name, name)").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const member = useQuery({
    queryKey: ["membership", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("memberships").select("user_id").eq("community_id", id).eq("user_id", user!.id).maybeSingle();
      return !!data;
    },
  });

  const posts = useQuery({
    queryKey: ["community-posts", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select(POST_SELECT).eq("community_id", id).eq("hidden", false).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
  });

  const toggle = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (member.data) {
        const { error } = await supabase.from("memberships").delete().eq("community_id", id).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("memberships").insert({ community_id: id, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membership", id] });
      toast.success(member.data ? "Left community" : "Joined!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      {community.data && (
        <div className="mb-6 rounded-2xl border border-border/60 bg-card p-5">
          <p className="text-xs uppercase tracking-widest text-primary">{community.data.school?.short_name} · {community.data.kind}</p>
          <h1 className="mt-1 font-display text-3xl">{community.data.name}</h1>
          {community.data.description && <p className="mt-2 text-sm text-muted-foreground">{community.data.description}</p>}
          <div className="mt-4 flex gap-2">
            <Button variant={member.data ? "secondary" : "default"} onClick={() => toggle.mutate()} className={!member.data ? "brand-gradient text-primary-foreground" : ""}>
              {member.data ? "Leave" : "Join"}
            </Button>
            <Button variant="outline" onClick={() => setComposeOpen(true)}>Post here</Button>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {posts.data?.map((p) => <PostCard key={p.id} post={p} />)}
        {posts.data && posts.data.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 p-6 text-sm text-muted-foreground">No posts yet — start the conversation.</div>
        )}
      </div>
      <Composer open={composeOpen} onOpenChange={setComposeOpen} defaultCommunityId={id} />
    </AppShell>
  );
}
