import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PostCard, POST_SELECT, type FeedPost } from "@/components/post-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuthUser, useProfile, initials, timeAgo } from "@/lib/profile";
import { Compass, Flame, Heart, MessageCircle, Users, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/discover")({
  component: Discover,
});

type Tab = "trending" | "campuses" | "communities";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function score(p: { like_count: number; comment_count: number; created_at: string }) {
  const ageH = Math.max(1, (Date.now() - new Date(p.created_at).getTime()) / 36e5);
  return (p.like_count * 2 + p.comment_count * 3) / Math.pow(ageH + 6, 0.6);
}

function firstImage(media: unknown): string | null {
  if (!media) return null;
  const arr = Array.isArray(media) ? media : [media];
  for (const m of arr) {
    if (typeof m === "string" && /^https?:/.test(m)) return m;
    if (m && typeof m === "object") {
      const o = m as Record<string, unknown>;
      const url = (o.url ?? o.src ?? o.uri) as string | undefined;
      const type = (o.type ?? o.kind ?? "") as string;
      if (url && (!type || type.startsWith("image"))) return url;
    }
  }
  return null;
}

function Discover() {
  const { user } = useAuthUser();
  const { data: me } = useProfile();
  const [tab, setTab] = useState<Tab>("trending");

  // --- Trending posts globally (last 7 days)
  const since = useMemo(() => new Date(Date.now() - SEVEN_DAYS_MS).toISOString(), []);

  const trendingQ = useQuery({
    queryKey: ["discover-trending", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(POST_SELECT + ", media")
        .eq("hidden", false)
        .gte("created_at", since)
        .order("like_count", { ascending: false })
        .limit(60);
      if (error) throw error;
      const rows = (data ?? []) as unknown as (FeedPost & { media: unknown })[];
      return [...rows].sort((a, b) => score(b) - score(a));
    },
  });

  // Fallback: newest posts when trending is too thin
  const fallbackQ = useQuery({
    queryKey: ["discover-fallback"],
    enabled: !trendingQ.isLoading && (trendingQ.data?.length ?? 0) < 3,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts").select(POST_SELECT)
        .eq("hidden", false).order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
  });

  // --- Schools + per-school stats and top snippet
  const schoolsQ = useQuery({
    queryKey: ["discover-schools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, short_name, city, banner_color")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const schoolPostsQ = useQuery({
    queryKey: ["discover-school-posts", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, body, school_id, like_count, comment_count, created_at, media, author:profiles!posts_author_id_profiles_fkey(id, display_name, avatar_url)")
        .eq("hidden", false)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(400);
      if (error) throw error;
      return data ?? [];
    },
  });

  const studentCountsQ = useQuery({
    queryKey: ["discover-student-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("primary_school_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const r of data ?? []) {
        const id = (r as { primary_school_id: string | null }).primary_school_id;
        if (id) counts[id] = (counts[id] ?? 0) + 1;
      }
      return counts;
    },
  });

  type SchoolPost = NonNullable<typeof schoolPostsQ.data>[number];
  const perSchool = useMemo(() => {
    const map = new Map<string, { top: SchoolPost; count: number; cover: string | null }>();
    for (const p of schoolPostsQ.data ?? []) {
      const sid = p.school_id;
      if (!sid) continue;
      const cur = map.get(sid);
      if (!cur) {
        map.set(sid, { top: p, count: 1, cover: firstImage(p.media) });
      } else {
        cur.count += 1;
        if (score(p) > score(cur.top)) cur.top = p;
        if (!cur.cover) cur.cover = firstImage(p.media);
      }
    }
    return map;
  }, [schoolPostsQ.data]);

  // --- Suggested people (not already connected, not me)
  const connectionsQ = useQuery({
    queryKey: ["my-connections-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("connections")
        .select("requester_id, addressee_id, status")
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`);
      if (error) throw error;
      const ids = new Set<string>();
      for (const c of data ?? []) {
        ids.add(c.requester_id === user!.id ? c.addressee_id : c.requester_id);
      }
      return ids;
    },
  });

  const suggestedQ = useQuery({
    queryKey: ["discover-suggested", me?.primary_school_id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const sameSchool = me?.primary_school_id
        ? await supabase
            .from("profiles")
            .select("id, display_name, avatar_url, primary_school_id, school:schools(short_name)")
            .eq("primary_school_id", me.primary_school_id)
            .neq("id", user!.id)
            .limit(20)
        : { data: [] as Array<{ id: string; display_name: string | null; avatar_url: string | null; primary_school_id: string | null; school: { short_name: string } | null }> };
      const others = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, primary_school_id, school:schools(short_name)")
        .neq("id", user!.id)
        .limit(20);
      const seen = new Set<string>();
      const merged: typeof others.data = [];
      for (const list of [sameSchool.data ?? [], others.data ?? []]) {
        for (const p of list) {
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          merged.push(p);
        }
      }
      return merged;
    },
  });

  // --- Trending communities by posts in last 7d
  const communitiesQ = useQuery({
    queryKey: ["discover-communities", since],
    queryFn: async () => {
      const { data: comms, error } = await supabase
        .from("communities").select("id, name, kind, school:schools(short_name)").limit(200);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const p of schoolPostsQ.data ?? []) {
        const cid = (p as unknown as { community_id?: string | null }).community_id;
        if (cid) counts[cid] = (counts[cid] ?? 0) + 1;
      }
      return (comms ?? [])
        .map((c) => ({ ...c, recent: counts[c.id] ?? 0 }))
        .sort((a, b) => b.recent - a.recent)
        .slice(0, 12);
    },
    enabled: !schoolPostsQ.isLoading,
  });

  return (
    <AppShell>
      <div className="mb-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
          <Compass className="h-4 w-4" />Discover
        </div>
        <h1 className="mt-1 font-display text-3xl">Trending across campuses</h1>
        <p className="text-sm text-muted-foreground">What students everywhere are talking about right now.</p>
      </div>

      <div className="mb-6 flex gap-1 border-b border-border/60">
        {([
          ["trending", "Trending posts", Flame],
          ["campuses", "Campuses", Compass],
          ["communities", "Communities", Users],
        ] as [Tab, string, typeof Flame][]).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition ${
              tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "trending" && (
        <div className="space-y-4">
          {trendingQ.isLoading && <Skeleton lines={3} />}
          {!trendingQ.isLoading && (trendingQ.data?.length ?? 0) >= 3 && (
            <>
              {trendingQ.data!.slice(0, 10).map((p) => <PostCard key={p.id} post={p} />)}
            </>
          )}
          {!trendingQ.isLoading && (trendingQ.data?.length ?? 0) < 3 && (
            <>
              <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
                Things are quiet across campuses this week. Here's what's new instead.
              </div>
              {(fallbackQ.data ?? []).map((p) => <PostCard key={p.id} post={p} />)}
            </>
          )}

          <SuggestedPeople
            people={(suggestedQ.data ?? []).filter((p) => !(connectionsQ.data?.has(p.id))).slice(0, 12)}
          />
        </div>
      )}

      {tab === "campuses" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(schoolsQ.data ?? []).map((s) => {
            const stats = perSchool.get(s.id);
            const students = studentCountsQ.data?.[s.id] ?? 0;
            return (
              <div key={s.id} className="overflow-hidden rounded-2xl border border-border/60 bg-card transition hover:border-primary/50">
                <Link to="/school/$schoolId" params={{ schoolId: s.id }} className="block">
                  <div
                    className="relative h-24 bg-cover bg-center"
                    style={{
                      backgroundImage: stats?.cover ? `url(${stats.cover})` : undefined,
                      background: stats?.cover ? undefined : `linear-gradient(135deg, ${s.banner_color}, #0a0d18)`,
                    }}
                  >
                    {stats?.cover && <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />}
                  </div>
                  <div className="p-4 pb-2">
                    <h3 className="font-display text-xl">{s.name}</h3>
                    <p className="text-xs text-muted-foreground">{s.short_name} · {s.city}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{students.toLocaleString()} students</span>
                      <span className="inline-flex items-center gap-1"><Flame className="h-3 w-3 text-primary" />{stats?.count ?? 0} posts this week</span>
                    </div>
                  </div>
                </Link>

                {stats?.top ? (
                  <Link
                    to="/post/$id"
                    params={{ id: stats.top.id }}
                    className="mx-3 mb-3 block rounded-xl border border-border/60 bg-background/60 p-3 transition hover:border-primary/50"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={stats.top.author?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">{initials(stats.top.author?.display_name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium">{stats.top.author?.display_name ?? "Student"}</span>
                      <span className="text-[10px] text-muted-foreground">· {timeAgo(stats.top.created_at)}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-foreground">{stats.top.body}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{stats.top.like_count}</span>
                      <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{stats.top.comment_count}</span>
                    </div>
                  </Link>
                ) : (
                  <p className="mx-3 mb-3 rounded-xl border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
                    No buzz this week — be the first to post in {s.short_name}.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "communities" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(communitiesQ.data ?? []).map((c) => (
            <Link
              key={c.id}
              to="/community/$id"
              params={{ id: c.id }}
              className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3 hover:border-primary/50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {(Array.isArray(c.school) ? c.school[0] : c.school)?.short_name ?? "Cross-campus"} · {c.kind}
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                <Flame className="h-3 w-3 text-primary" />{c.recent}
              </span>
            </Link>
          ))}
          {communitiesQ.data && communitiesQ.data.length === 0 && (
            <p className="text-sm text-muted-foreground">No active communities yet.</p>
          )}
        </div>
      )}
    </AppShell>
  );
}

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-card/60" />
      ))}
    </div>
  );
}

type SuggestedPerson = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  school: { short_name: string } | { short_name: string }[] | null;
};

function SuggestedPeople({ people }: { people: SuggestedPerson[] }) {
  const { user } = useAuthUser();
  const queryClient = useQueryClient();

  const connect = useMutation({
    mutationFn: async (otherId: string) => {
      if (!user) throw new Error("Sign in");
      const { error } = await supabase
        .from("connections")
        .insert({ requester_id: user.id, addressee_id: otherId, status: "pending" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request sent");
      queryClient.invalidateQueries({ queryKey: ["my-connections-ids"] });
      queryClient.invalidateQueries({ queryKey: ["connections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (people.length === 0) return null;

  return (
    <section className="mt-2">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
        <Sparkles className="h-3.5 w-3.5" /> People you may know
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto pb-2">
        {people.map((p) => {
          const school = Array.isArray(p.school) ? p.school[0] : p.school;
          return (
            <div key={p.id} className="w-40 shrink-0 rounded-2xl border border-border/60 bg-card p-3 text-center">
              <Link to="/u/$id" params={{ id: p.id }} className="block">
                <Avatar className="mx-auto h-12 w-12">
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback>{initials(p.display_name)}</AvatarFallback>
                </Avatar>
                <p className="mt-2 truncate text-sm font-medium">{p.display_name ?? "Student"}</p>
                <p className="truncate text-[11px] text-muted-foreground">{school?.short_name ?? ""}</p>
              </Link>
              <Button
                size="sm"
                className="mt-2 h-7 w-full brand-gradient text-xs text-primary-foreground"
                disabled={connect.isPending}
                onClick={() => connect.mutate(p.id)}
              >
                Connect
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
