import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PostCard, POST_SELECT, type FeedPost } from "@/components/post-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthUser, initials, timeAgo } from "@/lib/profile";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/post/$id")({
  component: PostDetail,
});

function PostDetail() {
  const { id } = Route.useParams();
  const { user } = useAuthUser();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");

  const post = useQuery({
    queryKey: ["post", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select(POST_SELECT).eq("id", id).single();
      if (error) throw error;
      return data as unknown as FeedPost;
    },
  });

  const comments = useQuery({
    queryKey: ["comments", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("comments")
        .select("id, body, created_at, parent_id, author:profiles!comments_author_id_profiles_fkey(id, display_name, avatar_url)")
        .eq("post_id", id).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in");
      const { error } = await supabase.from("comments").insert({ post_id: id, author_id: user.id, body: comment.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
      queryClient.invalidateQueries({ queryKey: ["post", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      {post.data && <PostCard post={post.data} />}
      <div className="mt-6">
        <h3 className="mb-3 text-xs uppercase tracking-widest text-primary">Comments</h3>
        <div className="space-y-3">
          {comments.data?.map((c) => {
            const a = Array.isArray(c.author) ? c.author[0] : c.author;
            return (
              <div key={c.id} className="rounded-xl border border-border/60 bg-card p-3">
                <div className="flex items-center gap-2">
                  <Link to="/u/$id" params={{ id: a?.id ?? "" }}>
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={a?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px]">{initials(a?.display_name)}</AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="text-xs">
                    <span className="font-medium">{a?.display_name ?? "Anon"}</span>
                    <span className="text-muted-foreground"> · {timeAgo(c.created_at)}</span>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{c.body}</p>
              </div>
            );
          })}
          {comments.data && comments.data.length === 0 && (
            <p className="text-sm text-muted-foreground">Be the first to reply.</p>
          )}
        </div>
        <div className="mt-4">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Reply…" rows={3} className="resize-none" />
          <div className="mt-2 flex justify-end">
            <Button onClick={() => add.mutate()} disabled={!comment.trim() || add.isPending} className="brand-gradient text-primary-foreground">
              {add.isPending ? "…" : "Reply"}
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
