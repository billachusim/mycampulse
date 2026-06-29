import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthUser, initials, timeAgo } from "@/lib/profile";
import { z } from "zod";

const searchSchema = z.object({ thread: z.string().optional() });

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: searchSchema,
  component: Messages,
});

function Messages() {
  const { user } = useAuthUser();
  const { thread } = Route.useSearch();
  const navigate = useNavigate();

  const convos = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("conversations")
        .select("id, user_a, user_b, last_message_at, pa:profiles!conversations_user_a_profiles_fkey(id, display_name, avatar_url), pb:profiles!conversations_user_b_profiles_fkey(id, display_name, avatar_url)")
        .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <h1 className="mb-4 font-display text-3xl">Messages</h1>
      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <aside className="space-y-1.5">
          {convos.data?.length === 0 && (
            <p className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
              No conversations yet. Connect with someone first — then message them from their profile.
            </p>
          )}
          {convos.data?.map((c) => {
            const otherRaw = c.user_a === user?.id ? c.pb : c.pa;
            const other = Array.isArray(otherRaw) ? otherRaw[0] : otherRaw;
            if (!other) return null;
            const active = c.id === thread;
            return (
              <button
                key={c.id}
                onClick={() => navigate({ to: "/messages", search: { thread: c.id } })}
                className={`flex w-full items-center gap-3 rounded-xl border border-border/60 p-3 text-left transition ${active ? "bg-secondary border-primary/40" : "bg-card hover:bg-secondary/60"}`}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={other.avatar_url ?? undefined} />
                  <AvatarFallback>{initials(other.display_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{other.display_name ?? "Anonymous"}</div>
                  <div className="text-xs text-muted-foreground">{timeAgo(c.last_message_at)}</div>
                </div>
              </button>
            );
          })}
        </aside>
        <section className="rounded-2xl border border-border/60 bg-card">
          {thread ? <Thread id={thread} /> : <div className="grid h-80 place-items-center text-sm text-muted-foreground">Pick a conversation</div>}
        </section>
      </div>
    </AppShell>
  );
}

function Thread({ id }: { id: string }) {
  const { user } = useAuthUser();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const msgs = useQuery({
    queryKey: ["messages", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("id, sender_id, body, created_at").eq("conversation_id", id).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["messages", id] });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.data]);

  const send = useMutation({
    mutationFn: async () => {
      if (!user || !text.trim()) return;
      const { error } = await supabase.from("messages").insert({ conversation_id: id, sender_id: user.id, body: text.trim() });
      if (error) throw error;
    },
    onSuccess: () => setText(""),
  });

  return (
    <div className="flex h-[60vh] flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.data?.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                {m.body}
                <div className="mt-0.5 text-[10px] opacity-70">{timeAgo(m.created_at)}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); send.mutate(); }}
        className="flex gap-2 border-t border-border/60 p-3"
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…" />
        <Button type="submit" disabled={!text.trim()} className="brand-gradient text-primary-foreground">Send</Button>
      </form>
    </div>
  );
}
