import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PostCard, POST_SELECT, type FeedPost } from "@/components/post-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EditProfileDialog } from "@/components/edit-profile-dialog";
import { useAuthUser, initials } from "@/lib/profile";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/u/$id")({
  component: ProfilePage,
});

function ProfilePage() {
  const { id } = Route.useParams();
  const { user } = useAuthUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMe = user?.id === id;
  const [editOpen, setEditOpen] = useState(false);

  const profile = useQuery({
    queryKey: ["profile-page", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles")
        .select("*, school:schools(id, name, short_name), faculty:faculties(name), department:departments(name)")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const conn = useQuery({
    queryKey: ["conn", user?.id, id],
    enabled: !!user && !isMe,
    queryFn: async () => {
      const { data } = await supabase.from("connections")
        .select("*")
        .or(`and(requester_id.eq.${user!.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user!.id})`)
        .maybeSingle();
      return data;
    },
  });

  const posts = useQuery({
    queryKey: ["user-posts", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select(POST_SELECT).eq("author_id", id).eq("hidden", false).order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
  });

  const request = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("connections").insert({ requester_id: user.id, addressee_id: id, status: "pending" });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["conn"] }); toast.success("Request sent"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const respond = useMutation({
    mutationFn: async (status: "accepted" | "declined") => {
      if (!conn.data) return;
      const { error } = await supabase.from("connections").update({ status, updated_at: new Date().toISOString() }).eq("id", conn.data.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conn"] }),
  });

  async function startChat() {
    if (!user) return;
    const [a, b] = user.id < id ? [user.id, id] : [id, user.id];
    const existing = await supabase.from("conversations").select("id").eq("user_a", a).eq("user_b", b).maybeSingle();
    let convId = existing.data?.id;
    if (!convId) {
      const { data, error } = await supabase.from("conversations").insert({ user_a: a, user_b: b }).select("id").single();
      if (error) { toast.error(error.message); return; }
      convId = data.id;
    }
    navigate({ to: "/messages", search: { thread: convId } });
  }

  const p = profile.data;
  return (
    <AppShell>
      {p && (
        <div className="mb-6 rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={p.avatar_url ?? undefined} />
              <AvatarFallback className="bg-secondary text-lg">{initials(p.display_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl">
                {p.display_name ?? "Anonymous"} {p.verified && <span className="text-primary text-base">✓</span>}
              </h1>
              <p className="text-sm text-muted-foreground">
                {p.school?.short_name}{p.faculty?.name ? ` · ${p.faculty.name}` : ""}{p.level ? ` · ${p.level}` : ""}
              </p>
              {p.bio && <p className="mt-2 text-sm">{p.bio}</p>}
            </div>
          </div>
          {!isMe && user && (
            <div className="mt-4 flex gap-2">
              {!conn.data && <Button onClick={() => request.mutate()} className="brand-gradient text-primary-foreground">Connect</Button>}
              {conn.data?.status === "pending" && conn.data.addressee_id === user.id && (
                <>
                  <Button onClick={() => respond.mutate("accepted")} className="brand-gradient text-primary-foreground">Accept</Button>
                  <Button variant="secondary" onClick={() => respond.mutate("declined")}>Decline</Button>
                </>
              )}
              {conn.data?.status === "pending" && conn.data.requester_id === user.id && (
                <Button variant="secondary" disabled>Request sent</Button>
              )}
              {conn.data?.status === "accepted" && (
                <Button onClick={startChat} className="brand-gradient text-primary-foreground">Message</Button>
              )}
            </div>
          )}
        </div>
      )}
      <h2 className="mb-3 text-xs uppercase tracking-widest text-primary">Posts</h2>
      <div className="space-y-3">
        {posts.data?.map((p) => <PostCard key={p.id} post={p} />)}
        {posts.data && posts.data.length === 0 && (
          <p className="text-sm text-muted-foreground">No posts yet.</p>
        )}
      </div>
    </AppShell>
  );
}
