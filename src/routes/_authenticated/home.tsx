import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/profile";
import { AppShell } from "@/components/app-shell";
import { PostCard, POST_SELECT, type FeedPost } from "@/components/post-card";
import { Flame, Building2, Layers, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomeFeed,
});

function HomeFeed() {
  const { data: profile } = useProfile();
  const schoolId = profile?.primary_school_id;
  const noSchool = !!profile && !schoolId; // admin / not onboarded to a school

  const yourSchool = useQuery({
    queryKey: ["feed", "school", schoolId ?? "all"],
    enabled: !!profile,
    queryFn: async () => {
      let q = supabase.from("posts").select(POST_SELECT).is("community_id", null).eq("hidden", false).order("created_at", { ascending: false }).limit(20);
      if (schoolId) q = q.eq("school_id", schoolId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
  });

  const yourCommunities = useQuery({
    queryKey: ["feed", "communities", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data: mems } = await supabase.from("memberships").select("community_id").eq("user_id", profile!.id);
      const ids = (mems ?? []).map((m) => m.community_id);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .in("community_id", ids)
        .eq("hidden", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
  });

  const trending = useQuery({
    queryKey: ["feed", "trending", schoolId ?? "all"],
    enabled: !!profile,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      let q = supabase.from("posts").select(POST_SELECT).eq("hidden", false).gte("created_at", since)
        .order("like_count", { ascending: false }).order("comment_count", { ascending: false }).limit(10);
      if (schoolId) q = q.eq("school_id", schoolId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
  });

  return (
    <AppShell>
      <div className="space-y-10">
        <Rail
          icon={<Building2 className="h-4 w-4" />}
          eyebrow={noSchool ? "All Schools" : "Your School"}
          title={noSchool ? "Every campus" : (profile?.school?.name ?? "Your campus")}
          subtitle={noSchool ? "Admin view — posts across every school" : "Everyone in your school"}
          posts={yourSchool.data}
          loading={yourSchool.isPending}
          emptyHint="No school-wide posts yet — be the first to say hi."
        />
        <Rail
          icon={<Layers className="h-4 w-4" />}
          eyebrow="Your Communities"
          title="Faculty, dept, level & clubs"
          subtitle="The rooms you actually live in"
          posts={yourCommunities.data}
          loading={yourCommunities.isPending}
          emptyHint={
            noSchool ? (
              <>You haven't joined any communities yet. <Link to="/discover" className="text-primary underline">Pick a school</Link> to explore.</>
            ) : (
              <>
                No community posts yet.{" "}
                <Link to="/school/$schoolId" params={{ schoolId: schoolId ?? "" }} className="text-primary underline">
                  Find your faculty
                </Link>.
              </>
            )
          }
        />
        <Rail
          icon={<Flame className="h-4 w-4" />}
          eyebrow="Campus Trending"
          title={noSchool ? "Trending across Campulse" : "What's hot on campus today"}
          subtitle="Last 24h, by engagement"
          posts={trending.data}
          loading={trending.isPending}
          emptyHint="Nothing trending yet — start a conversation."
        />
        <div className="pt-4 text-center text-xs text-muted-foreground">
          <Sparkles className="mx-auto mb-1 h-4 w-4 text-primary" />
          That's your campus today.{" "}
          <Link to="/discover" className="text-primary underline">Peek at other schools</Link>.
        </div>
      </div>
    </AppShell>
  );
}

function Rail({ icon, eyebrow, title, subtitle, posts, loading, emptyHint }: {
  icon: React.ReactNode; eyebrow: string; title: string; subtitle: string;
  posts: FeedPost[] | undefined; loading: boolean; emptyHint: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">{icon}{eyebrow}</div>
        <h2 className="mt-1 font-display text-2xl leading-tight">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </header>
      <div className="space-y-3">
        {loading && <div className="h-24 animate-pulse rounded-2xl bg-card" />}
        {!loading && (!posts || posts.length === 0) && (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 p-6 text-sm text-muted-foreground">{emptyHint}</div>
        )}
        {posts?.map((p) => <PostCard key={p.id} post={p} />)}
      </div>
    </section>
  );
}
