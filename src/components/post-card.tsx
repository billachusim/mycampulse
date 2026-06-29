import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Share2, Flag, MoreHorizontal } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthUser, timeAgo, initials } from "@/lib/profile";
import { toast } from "sonner";

export type FeedPost = {
  id: string;
  body: string;
  created_at: string;
  like_count: number;
  comment_count: number;
  hidden: boolean;
  author: { id: string; display_name: string | null; avatar_url: string | null; verified: boolean } | null;
  school: { short_name: string; id: string } | null;
  community: { id: string; name: string; kind: string } | null;
};

export const POST_SELECT =
  "id, body, created_at, like_count, comment_count, hidden, author:profiles!posts_author_id_profiles_fkey(id, display_name, avatar_url, verified), school:schools(id, short_name), community:communities(id, name, kind)";

export function PostCard({ post }: { post: FeedPost }) {
  const { user } = useAuthUser();
  const queryClient = useQueryClient();

  const { data: liked = false } = useQuery({
    queryKey: ["liked", post.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("likes").select("post_id").eq("post_id", post.id).eq("user_id", user!.id).maybeSingle();
      return !!data;
    },
  });

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to like");
      if (liked) {
        const { error } = await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liked", post.id] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["post", post.id] });
    },
  });

  const report = useMutation({
    mutationFn: async (reason: string) => {
      if (!user) throw new Error("Sign in to report");
      const { error } = await supabase.from("reports").insert({ target_kind: "post", target_id: post.id, reporter_id: user.id, reason });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Thanks — we'll take a look"),
    onError: (e: Error) => toast.error(e.message),
  });

  async function share() {
    const url = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      try { await navigator.share({ url, title: "Campulse post" }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    }
  }

  return (
    <article className="rounded-2xl border border-border/60 bg-card p-4 transition hover:border-border">
      <header className="flex items-start gap-3">
        <Link to="/u/$id" params={{ id: post.author?.id ?? "" }}>
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.author?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-secondary text-xs">{initials(post.author?.display_name)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
            <Link to="/u/$id" params={{ id: post.author?.id ?? "" }} className="font-medium hover:underline">
              {post.author?.display_name ?? "Anonymous"}
            </Link>
            {post.author?.verified && <span className="text-primary" title="Verified student">✓</span>}
            <span className="text-muted-foreground">· {timeAgo(post.created_at)}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {post.school && (
              <Link to="/school/$schoolId" params={{ schoolId: post.school.id }} className="rounded-full bg-secondary px-2 py-0.5 hover:text-foreground">
                {post.school.short_name}
              </Link>
            )}
            {post.community && (
              <Link to="/community/$id" params={{ id: post.community.id }} className="rounded-full bg-secondary px-2 py-0.5 hover:text-foreground">
                {post.community.name}
              </Link>
            )}
          </div>
        </div>
        <button onClick={() => report.mutate("Inappropriate")} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Report">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </header>
      <Link to="/post/$id" params={{ id: post.id }} className="mt-3 block whitespace-pre-wrap text-[15px] leading-relaxed">
        {post.body}
      </Link>
      <footer className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
        <button onClick={() => toggleLike.mutate()} className={`flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-secondary ${liked ? "text-primary" : ""}`}>
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {post.like_count}
        </button>
        <Link to="/post/$id" params={{ id: post.id }} className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-secondary">
          <MessageCircle className="h-4 w-4" /> {post.comment_count}
        </Link>
        <button onClick={share} className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-secondary">
          <Share2 className="h-4 w-4" />
        </button>
        <button onClick={() => report.mutate("Inappropriate")} className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-secondary">
          <Flag className="h-4 w-4" />
        </button>
      </footer>
    </article>
  );
}
