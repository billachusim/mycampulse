import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand-logo";
import { PostCard, POST_SELECT, type FeedPost } from "@/components/post-card";
import { Flame, Sparkles, Globe2 } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Campulse — Your Campus Heartbeat" },
      { name: "description", content: "Your Campus Heartbeat. School-first feed, communities, and Campoints that turn campus life into airtime and naira." },
      { property: "og:title", content: "Campulse — Your Campus Heartbeat" },
      { property: "og:description", content: "Your school. Your communities. Get paid in Campoints for showing up." },
    ],
  }),
  component: PublicHome,
});

function PublicHome() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);
  useEffect(() => {
    if (authed) window.location.replace("/home");
  }, [authed]);

  const recent = useQuery({
    queryKey: ["public-feed", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .is("community_id", null)
        .eq("hidden", false)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
  });

  const trending = useQuery({
    queryKey: ["public-feed", "trending"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .eq("hidden", false)
        .gte("created_at", since)
        .order("like_count", { ascending: false })
        .order("comment_count", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
  });

  if (authed) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo size={28} withWordmark wordmarkClassName="text-lg" />
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-secondary">Sign in</Link>
            <Link to="/auth" className="rounded-md brand-gradient px-3 py-1.5 text-sm font-semibold text-primary-foreground">Join</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <section className="mb-8 rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
          <p className="text-xs uppercase tracking-widest text-primary">Your campus heartbeat</p>
          <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">
            Peek inside Campulse.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Browse what students across Nigerian campuses are posting right now. Sign in to like, comment, post, and start earning Campoints.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/auth" className="rounded-md brand-gradient px-4 py-2 text-sm font-semibold text-primary-foreground">Create free account</Link>
            <Link to="/auth" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary">I already have one</Link>
          </div>
        </section>

        <section className="mb-10">
          <header className="mb-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
              <Flame className="h-4 w-4" /> Trending today
            </div>
            <h2 className="mt-1 font-display text-2xl">What's hot across Campulse</h2>
            <p className="text-xs text-muted-foreground">Last 24h, by engagement</p>
          </header>
          <div className="space-y-3">
            {trending.isPending && <div className="h-24 animate-pulse rounded-2xl bg-card" />}
            {!trending.isPending && (trending.data?.length ?? 0) === 0 && (
              <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 p-6 text-sm text-muted-foreground">
                Nothing trending yet — be the first to start a conversation.
              </div>
            )}
            {trending.data?.map((p) => <PostCard key={p.id} post={p} readOnly />)}
          </div>
        </section>

        <section className="mb-10">
          <header className="mb-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
              <Globe2 className="h-4 w-4" /> Latest from every campus
            </div>
            <h2 className="mt-1 font-display text-2xl">Fresh off the timeline</h2>
            <p className="text-xs text-muted-foreground">School-wide posts, newest first</p>
          </header>
          <div className="space-y-3">
            {recent.isPending && <div className="h-24 animate-pulse rounded-2xl bg-card" />}
            {!recent.isPending && (recent.data?.length ?? 0) === 0 && (
              <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 p-6 text-sm text-muted-foreground">
                No posts yet. <Link to="/auth" className="text-primary underline">Sign in</Link> to be the first.
              </div>
            )}
            {recent.data?.map((p) => <PostCard key={p.id} post={p} readOnly />)}
          </div>
        </section>

        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center">
          <Sparkles className="mx-auto mb-2 h-5 w-5 text-primary" />
          <p className="font-display text-xl">Like what you see?</p>
          <p className="mt-1 text-sm text-muted-foreground">Join your campus to post, comment, and start earning Campoints.</p>
          <Link to="/auth" className="mt-4 inline-block rounded-md brand-gradient px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            Join Campulse
          </Link>
        </div>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        © Campulse · Your campus heartbeat.
      </footer>
    </div>
  );
}
