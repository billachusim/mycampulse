import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PostCard, POST_SELECT, type FeedPost } from "@/components/post-card";
import { Hash } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tag/$tag")({
  component: TagPage,
});

function TagPage() {
  const { tag } = Route.useParams();
  const lower = tag.toLowerCase();

  const postsQ = useQuery({
    queryKey: ["tag-posts", lower],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .contains("hashtags", [lower])
        .eq("hidden", false)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
  });

  return (
    <AppShell>
      <div className="mb-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
          <Hash className="h-4 w-4" /> Hashtag
        </div>
        <h1 className="mt-1 font-display text-3xl">#{lower}</h1>
        <p className="text-sm text-muted-foreground">{postsQ.data?.length ?? 0} posts</p>
      </div>
      <div className="space-y-3">
        {postsQ.isLoading && <div className="h-32 animate-pulse rounded-2xl bg-card/60" />}
        {(postsQ.data ?? []).map((p) => <PostCard key={p.id} post={p} />)}
        {!postsQ.isLoading && (postsQ.data?.length ?? 0) === 0 && (
          <p className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            No posts with this tag yet.
          </p>
        )}
      </div>
    </AppShell>
  );
}
