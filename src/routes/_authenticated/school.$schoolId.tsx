import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PostCard, POST_SELECT, type FeedPost } from "@/components/post-card";
import { Flame } from "lucide-react";

export const Route = createFileRoute("/_authenticated/school/$schoolId")({
  component: SchoolPage,
});

function SchoolPage() {
  const { schoolId } = Route.useParams();

  const school = useQuery({
    queryKey: ["school", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("*").eq("id", schoolId).single();
      if (error) throw error;
      return data;
    },
  });

  const communities = useQuery({
    queryKey: ["school-communities", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("communities").select("id, name, kind").eq("school_id", schoolId).order("kind");
      if (error) throw error;
      return data ?? [];
    },
  });

  const trending = useQuery({
    queryKey: ["school-trending", schoolId],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase.from("posts").select(POST_SELECT)
        .eq("school_id", schoolId).eq("hidden", false).gte("created_at", since)
        .order("like_count", { ascending: false }).limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
  });

  return (
    <AppShell>
      {school.data && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-border/60">
          <div className="h-28" style={{ background: `linear-gradient(135deg, ${school.data.banner_color}, #0a0d18)` }} />
          <div className="p-5">
            <h1 className="font-display text-3xl">{school.data.name}</h1>
            <p className="text-sm text-muted-foreground">{school.data.short_name} · {school.data.city}</p>
          </div>
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-xs uppercase tracking-widest text-primary">Communities</h2>
        <div className="flex flex-wrap gap-2">
          {(communities.data ?? []).map((c) => (
            <Link key={c.id} to="/community/$id" params={{ id: c.id }} className="rounded-full border border-border/60 bg-card px-3 py-1.5 text-sm hover:border-primary/60">
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
          <Flame className="h-4 w-4" /> Trending today
        </h2>
        <div className="space-y-3">
          {trending.data?.map((p) => <PostCard key={p.id} post={p} />)}
          {trending.data && trending.data.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 p-6 text-sm text-muted-foreground">No trending posts yet on this campus.</div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
