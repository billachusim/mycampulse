import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PostCard, POST_SELECT, type FeedPost } from "@/components/post-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuthUser, useProfile, initials, timeAgo } from "@/lib/profile";
import { formatPoints } from "@/lib/campoints";
import {
  Compass, Flame, Heart, MessageCircle, Users, Sparkles, Search, CalendarDays, MapPin,
  ShoppingBag, Tag, Trophy, Coins, Hash, Radio, Star, Swords,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/discover")({
  component: Discover,
});

type Tab = "for-you" | "trending" | "campuses" | "communities";
type Window = "24h" | "7d" | "all";

function windowMs(w: Window) {
  return w === "24h" ? 24 * 3600 * 1000 : w === "7d" ? 7 * 24 * 3600 * 1000 : 365 * 24 * 3600 * 1000;
}

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

function naira(n: number) { return "₦" + n.toLocaleString(); }

function Discover() {
  const { user } = useAuthUser();
  const { data: me } = useProfile();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("for-you");
  const [win, setWin] = useState<Window>("7d");
  const [query, setQuery] = useState("");

  const since = useMemo(() => new Date(Date.now() - windowMs(win)).toISOString(), [win]);

  // ---- Trending posts
  const trendingQ = useQuery({
    queryKey: ["discover-trending", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts").select(POST_SELECT + ", media, hashtags")
        .eq("hidden", false).gte("created_at", since)
        .order("like_count", { ascending: false }).limit(80);
      if (error) throw error;
      const rows = (data ?? []) as unknown as (FeedPost & { media: unknown; hashtags: string[] | null })[];
      return [...rows].sort((a, b) => score(b) - score(a));
    },
  });

  // ---- Trending hashtags (derived from trending posts)
  const hashtags = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of trendingQ.data ?? []) {
      for (const t of p.hashtags ?? []) counts[t] = (counts[t] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [trendingQ.data]);

  // ---- Live now (last 30 min)
  const liveQ = useQuery({
    queryKey: ["discover-live"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const ago = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("posts").select(POST_SELECT).eq("hidden", false)
        .gte("created_at", ago).order("created_at", { ascending: false }).limit(6);
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
  });

  // ---- Events rail
  const eventsQ = useQuery({
    queryKey: ["events-rail"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, cover_url, location, starts_at, rsvp_count, school:schools(short_name)")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at").limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---- Marketplace rail
  const marketQ = useQuery({
    queryKey: ["market-rail"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_items")
        .select("id, title, price_naira, image_url, school:schools(short_name)")
        .eq("status", "available").order("created_at", { ascending: false }).limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---- Leaderboard top 5
  const leaderQ = useQuery({
    queryKey: ["leader-rail"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campoints_balances")
        .select("user_id, balance, user:profiles!campoints_balances_user_id_fkey(id, display_name, avatar_url, school:schools(short_name))")
        .order("balance", { ascending: false }).limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---- Schools
  const schoolsQ = useQuery({
    queryKey: ["discover-schools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools").select("id, name, short_name, city, banner_color").order("name");
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
        .eq("hidden", false).gte("created_at", since)
        .order("created_at", { ascending: false }).limit(500);
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
      if (!cur) map.set(sid, { top: p, count: 1, cover: firstImage(p.media) });
      else {
        cur.count += 1;
        if (score(p) > score(cur.top)) cur.top = p;
        if (!cur.cover) cur.cover = firstImage(p.media);
      }
    }
    return map;
  }, [schoolPostsQ.data]);

  // ---- Cross-campus battle: my school vs top other this week
  const battle = useMemo(() => {
    if (!me?.primary_school_id || !perSchool.size || !schoolsQ.data) return null;
    const mine = perSchool.get(me.primary_school_id);
    const rivals = [...perSchool.entries()]
      .filter(([sid]) => sid !== me.primary_school_id)
      .sort((a, b) => b[1].count - a[1].count);
    if (!rivals.length) return null;
    const [rivalId, rivalStats] = rivals[0];
    const mySchool = schoolsQ.data.find((s) => s.id === me.primary_school_id);
    const rivalSchool = schoolsQ.data.find((s) => s.id === rivalId);
    if (!mySchool || !rivalSchool) return null;
    return {
      mine: { school: mySchool, count: mine?.count ?? 0 },
      rival: { school: rivalSchool, count: rivalStats.count },
    };
  }, [me?.primary_school_id, perSchool, schoolsQ.data]);

  // ---- Featured creators (top by post count this window)
  const featuredCreators = useMemo(() => {
    const counts = new Map<string, { user: { id: string; display_name: string | null; avatar_url: string | null }; posts: number; likes: number }>();
    for (const p of schoolPostsQ.data ?? []) {
      const a = (Array.isArray(p.author) ? p.author[0] : p.author) as { id: string; display_name: string | null; avatar_url: string | null } | null;
      if (!a) continue;
      const cur = counts.get(a.id) ?? { user: a, posts: 0, likes: 0 };
      cur.posts += 1; cur.likes += p.like_count;
      counts.set(a.id, cur);
    }
    return [...counts.values()].sort((a, b) => b.likes + b.posts * 5 - (a.likes + a.posts * 5)).slice(0, 8);
  }, [schoolPostsQ.data]);

  // ---- My faculty rail
  const myFacultyQ = useQuery({
    queryKey: ["discover-school-rail", me?.primary_school_id],
    enabled: !!me?.primary_school_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select(POST_SELECT)
        .eq("hidden", false).eq("school_id", me!.primary_school_id!)
        .order("created_at", { ascending: false }).limit(6);
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
    },
  });

  // ---- Suggested people
  const connectionsQ = useQuery({
    queryKey: ["my-connections-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("connections").select("requester_id, addressee_id, status")
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`);
      if (error) throw error;
      const ids = new Set<string>();
      for (const c of data ?? []) ids.add(c.requester_id === user!.id ? c.addressee_id : c.requester_id);
      return ids;
    },
  });

  const suggestedQ = useQuery({
    queryKey: ["discover-suggested", me?.primary_school_id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const sameSchool = me?.primary_school_id
        ? await supabase.from("profiles")
            .select("id, display_name, avatar_url, primary_school_id, school:schools(short_name)")
            .eq("primary_school_id", me.primary_school_id).neq("id", user!.id).limit(20)
        : { data: [] as Array<{ id: string; display_name: string | null; avatar_url: string | null; primary_school_id: string | null; school: { short_name: string } | null }> };
      const others = await supabase.from("profiles")
        .select("id, display_name, avatar_url, primary_school_id, school:schools(short_name)")
        .neq("id", user!.id).limit(20);
      const seen = new Set<string>();
      const merged: typeof others.data = [];
      for (const list of [sameSchool.data ?? [], others.data ?? []]) {
        for (const p of list) {
          if (seen.has(p.id)) continue;
          seen.add(p.id); merged.push(p);
        }
      }
      return merged;
    },
  });

  // ---- Communities
  const communitiesQ = useQuery({
    queryKey: ["discover-communities", since],
    enabled: !schoolPostsQ.isLoading,
    queryFn: async () => {
      const { data: comms, error } = await supabase
        .from("communities").select("id, name, kind, school:schools(short_name)").limit(300);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const p of schoolPostsQ.data ?? []) {
        const cid = (p as unknown as { community_id?: string | null }).community_id;
        if (cid) counts[cid] = (counts[cid] ?? 0) + 1;
      }
      return (comms ?? []).map((c) => ({ ...c, recent: counts[c.id] ?? 0 }))
        .sort((a, b) => b.recent - a.recent).slice(0, 16);
    },
  });

  // ---- Search
  const searchQ = useQuery({
    queryKey: ["discover-search", query],
    enabled: query.trim().length >= 2,
    queryFn: async () => {
      const q = query.trim();
      const [posts, people, schools] = await Promise.all([
        supabase.from("posts").select(POST_SELECT).ilike("body", `%${q}%`).eq("hidden", false).order("created_at", { ascending: false }).limit(10),
        supabase.from("profiles").select("id, display_name, avatar_url, school:schools(short_name)").ilike("display_name", `%${q}%`).limit(8),
        supabase.from("schools").select("id, name, short_name").ilike("name", `%${q}%`).limit(5),
      ]);
      return {
        posts: (posts.data ?? []) as unknown as FeedPost[],
        people: people.data ?? [],
        schools: schools.data ?? [],
      };
    },
  });

  const trimmedQuery = query.trim();

  return (
    <AppShell>
      <div className="mb-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
          <Compass className="h-4 w-4" />Discover
        </div>
        <h1 className="mt-1 font-display text-3xl">Your campus heartbeat</h1>
        <p className="text-sm text-muted-foreground">Trending posts, events, market, hashtags — all in one place.</p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search posts, people, schools…"
          className="w-full rounded-full border border-border/60 bg-card/60 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary/60"
        />
      </div>

      {trimmedQuery.length >= 2 ? (
        <SearchResults q={trimmedQuery} data={searchQ.data} isLoading={searchQ.isLoading} />
      ) : (
        <>
          {/* Time window + tabs */}
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex gap-1 border-b border-border/60">
              {([
                ["for-you", "For you", Sparkles],
                ["trending", "Trending", Flame],
                ["campuses", "Campuses", Compass],
                ["communities", "Communities", Users],
              ] as [Tab, string, typeof Flame][]).map(([key, label, Icon]) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition ${tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
            <div className="hidden gap-1 rounded-full border border-border/60 bg-card p-0.5 text-[11px] sm:flex">
              {(["24h", "7d", "all"] as Window[]).map((w) => (
                <button key={w} onClick={() => setWin(w)}
                  className={`rounded-full px-2.5 py-1 ${win === w ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {w === "24h" ? "Today" : w === "7d" ? "Week" : "All"}
                </button>
              ))}
            </div>
          </div>

          {tab === "for-you" && (
            <div className="space-y-6">
              {hashtags.length > 0 && (
                <RailHeader icon={Hash} title="Trending hashtags">
                  <div className="-mx-1 flex flex-wrap gap-2">
                    {hashtags.map(([t, n]) => (
                      <Link key={t} to="/tag/$tag" params={{ tag: t }}
                        className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-3 py-1 text-xs hover:border-primary/60">
                        <Hash className="h-3 w-3 text-primary" />{t} <span className="text-muted-foreground">· {n}</span>
                      </Link>
                    ))}
                  </div>
                </RailHeader>
              )}

              {(liveQ.data?.length ?? 0) > 0 && (
                <RailHeader icon={Radio} title="Live now" subtitle="Posted in the last 30 minutes">
                  <div className="-mx-1 flex gap-2 overflow-x-auto pb-2">
                    {liveQ.data!.map((p) => (
                      <Link key={p.id} to="/post/$id" params={{ id: p.id }}
                        className="w-64 shrink-0 rounded-2xl border border-border/60 bg-card p-3 hover:border-primary/50">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6"><AvatarImage src={p.author?.avatar_url ?? undefined} /><AvatarFallback className="text-[10px]">{initials(p.author?.display_name)}</AvatarFallback></Avatar>
                          <span className="text-xs font-medium">{p.author?.display_name ?? "Student"}</span>
                          <span className="text-[10px] text-primary">● live</span>
                        </div>
                        <p className="mt-1.5 line-clamp-3 text-sm">{p.body}</p>
                      </Link>
                    ))}
                  </div>
                </RailHeader>
              )}

              {(eventsQ.data?.length ?? 0) > 0 && (
                <RailHeader icon={CalendarDays} title="This week on campus" link={{ to: "/events", label: "All events" }}>
                  <div className="-mx-1 flex gap-3 overflow-x-auto pb-2">
                    {eventsQ.data!.map((e) => {
                      const sch = Array.isArray(e.school) ? e.school[0] : e.school;
                      return (
                        <Link key={e.id} to="/events"
                          className="w-64 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-card hover:border-primary/50">
                          <div className="h-28 bg-cover bg-center bg-secondary" style={{ backgroundImage: e.cover_url ? `url(${e.cover_url})` : undefined }} />
                          <div className="p-3">
                            <p className="line-clamp-1 text-sm font-semibold">{e.title}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{new Date(e.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                              {e.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span>}
                              <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{e.rsvp_count}</span>
                              {sch && <span className="rounded-full bg-secondary px-1.5">{sch.short_name}</span>}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </RailHeader>
              )}

              {(marketQ.data?.length ?? 0) > 0 && (
                <RailHeader icon={ShoppingBag} title="On the marketplace" link={{ to: "/market", label: "Browse all" }}>
                  <div className="-mx-1 flex gap-3 overflow-x-auto pb-2">
                    {marketQ.data!.map((it) => {
                      const sch = Array.isArray(it.school) ? it.school[0] : it.school;
                      return (
                        <Link key={it.id} to="/market"
                          className="w-40 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-card hover:border-primary/50">
                          <div className="aspect-square bg-cover bg-center bg-secondary" style={{ backgroundImage: it.image_url ? `url(${it.image_url})` : undefined }} />
                          <div className="p-2">
                            <p className="line-clamp-1 text-xs font-medium">{it.title}</p>
                            <p className="text-sm font-semibold text-primary">{naira(it.price_naira)}</p>
                            {sch && <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Tag className="h-2.5 w-2.5" />{sch.short_name}</p>}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </RailHeader>
              )}

              {battle && (
                <RailHeader icon={Swords} title="Cross-campus battle this week">
                  <div className="rounded-2xl border border-border/60 bg-card p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-center">
                        <p className="font-display text-2xl">{battle.mine.school.short_name}</p>
                        <p className="text-3xl font-bold text-primary">{battle.mine.count}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">posts</p>
                      </div>
                      <span className="font-display text-lg text-muted-foreground">vs</span>
                      <div className="text-center">
                        <p className="font-display text-2xl">{battle.rival.school.short_name}</p>
                        <p className="text-3xl font-bold text-foreground">{battle.rival.count}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">posts</p>
                      </div>
                    </div>
                    <p className="mt-3 text-center text-xs text-muted-foreground">
                      {battle.mine.count > battle.rival.count
                        ? `${battle.mine.school.short_name} is leading by ${battle.mine.count - battle.rival.count}. Keep posting!`
                        : `${battle.rival.school.short_name} is ahead by ${battle.rival.count - battle.mine.count}. Help your campus catch up.`}
                    </p>
                  </div>
                </RailHeader>
              )}

              {(myFacultyQ.data?.length ?? 0) > 0 && (
                <RailHeader icon={Sparkles} title={me?.faculty_id ? "From your faculty" : "From your school"}>
                  <div className="-mx-1 flex gap-2 overflow-x-auto pb-2">
                    {myFacultyQ.data!.map((p) => (
                      <Link key={p.id} to="/post/$id" params={{ id: p.id }}
                        className="w-72 shrink-0 rounded-2xl border border-border/60 bg-card p-3 hover:border-primary/50">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6"><AvatarImage src={p.author?.avatar_url ?? undefined} /><AvatarFallback className="text-[10px]">{initials(p.author?.display_name)}</AvatarFallback></Avatar>
                          <span className="text-xs font-medium">{p.author?.display_name ?? "Student"}</span>
                          <span className="text-[10px] text-muted-foreground">· {timeAgo(p.created_at)}</span>
                        </div>
                        <p className="mt-1.5 line-clamp-3 text-sm">{p.body}</p>
                      </Link>
                    ))}
                  </div>
                </RailHeader>
              )}

              {(leaderQ.data?.length ?? 0) > 0 && (
                <RailHeader icon={Trophy} title="Top earners this week" link={{ to: "/leaderboard", label: "Full board" }}>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {leaderQ.data!.map((row, i) => {
                      const u = Array.isArray(row.user) ? row.user[0] : row.user;
                      const sch = u ? (Array.isArray(u.school) ? u.school[0] : u.school) : null;
                      return (
                        <Link key={row.user_id} to="/u/$id" params={{ id: u?.id ?? "" }}
                          className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-2 hover:border-primary/50">
                          <span className="w-5 text-center text-xs text-muted-foreground">{i + 1}</span>
                          <Avatar className="h-7 w-7"><AvatarImage src={u?.avatar_url ?? undefined} /><AvatarFallback className="text-[10px]">{initials(u?.display_name)}</AvatarFallback></Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{u?.display_name ?? "Student"}</p>
                            <p className="truncate text-[10px] text-muted-foreground">{sch?.short_name ?? "—"}</p>
                          </div>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                            <Coins className="h-3 w-3" />{formatPoints(row.balance)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </RailHeader>
              )}

              {featuredCreators.length > 0 && (
                <RailHeader icon={Star} title="Featured creators">
                  <div className="-mx-1 flex gap-2 overflow-x-auto pb-2">
                    {featuredCreators.map((c) => (
                      <Link key={c.user.id} to="/u/$id" params={{ id: c.user.id }}
                        className="w-36 shrink-0 rounded-2xl border border-border/60 bg-card p-3 text-center hover:border-primary/50">
                        <Avatar className="mx-auto h-12 w-12"><AvatarImage src={c.user.avatar_url ?? undefined} /><AvatarFallback>{initials(c.user.display_name)}</AvatarFallback></Avatar>
                        <p className="mt-2 truncate text-xs font-medium">{c.user.display_name ?? "Student"}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{c.posts} posts · {c.likes} likes</p>
                      </Link>
                    ))}
                  </div>
                </RailHeader>
              )}

              <SuggestedPeople people={(suggestedQ.data ?? []).filter((p) => !(connectionsQ.data?.has(p.id))).slice(0, 12)} />
            </div>
          )}

          {tab === "trending" && (
            <div className="space-y-4">
              {hashtags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {hashtags.slice(0, 8).map(([t, n]) => (
                    <Link key={t} to="/tag/$tag" params={{ tag: t }}
                      className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-3 py-1 text-xs hover:border-primary/60">
                      <Hash className="h-3 w-3 text-primary" />{t} <span className="text-muted-foreground">· {n}</span>
                    </Link>
                  ))}
                </div>
              )}
              {trendingQ.isLoading && <div className="h-28 animate-pulse rounded-2xl bg-card/60" />}
              {(trendingQ.data ?? []).slice(0, 20).map((p) => <PostCard key={p.id} post={p} />)}
              {!trendingQ.isLoading && (trendingQ.data?.length ?? 0) === 0 && (
                <p className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                  Quiet across campuses right now. Try widening the time window.
                </p>
              )}
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
                      <div className="relative h-24 bg-cover bg-center"
                        style={{ backgroundImage: stats?.cover ? `url(${stats.cover})` : undefined, background: stats?.cover ? undefined : `linear-gradient(135deg, ${s.banner_color}, #0a0d18)` }}>
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
                      <Link to="/post/$id" params={{ id: stats.top.id }}
                        className="mx-3 mb-3 block rounded-xl border border-border/60 bg-background/60 p-3 transition hover:border-primary/50">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={(Array.isArray(stats.top.author) ? stats.top.author[0] : stats.top.author)?.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[10px]">{initials((Array.isArray(stats.top.author) ? stats.top.author[0] : stats.top.author)?.display_name)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium">{(Array.isArray(stats.top.author) ? stats.top.author[0] : stats.top.author)?.display_name ?? "Student"}</span>
                          <span className="text-[10px] text-muted-foreground">· {timeAgo(stats.top.created_at)}</span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-sm">{stats.top.body}</p>
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
                <Link key={c.id} to="/community/$id" params={{ id: c.id }}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3 hover:border-primary/50">
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

          {/* Quick links footer */}
          <div className="mt-8 grid grid-cols-3 gap-2">
            <QuickLink to="/events" icon={CalendarDays} label="Events" />
            <QuickLink to="/market" icon={ShoppingBag} label="Marketplace" />
            <QuickLink to="/leaderboard" icon={Trophy} label="Leaderboard" />
          </div>
          {/* hidden navigate to keep hook referenced */}
          <span className="hidden" aria-hidden onClick={() => navigate({ to: "/home" })} />
        </>
      )}
    </AppShell>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: "/events" | "/market" | "/leaderboard"; icon: typeof Flame; label: string }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-1 rounded-2xl border border-border/60 bg-card p-3 text-center text-xs hover:border-primary/50">
      <Icon className="h-5 w-5 text-primary" />{label}
    </Link>
  );
}

function RailHeader({ icon: Icon, title, subtitle, link, children }: { icon: typeof Flame; title: string; subtitle?: string; link?: { to: "/events" | "/market" | "/leaderboard"; label: string }; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
          <Icon className="h-3.5 w-3.5" /> {title}
        </div>
        {link && <Link to={link.to} className="text-xs text-muted-foreground hover:text-foreground">{link.label} →</Link>}
      </div>
      {subtitle && <p className="mb-2 text-[11px] text-muted-foreground">{subtitle}</p>}
      {children}
    </section>
  );
}

type SearchPerson = { id: string; display_name: string | null; avatar_url: string | null; school: { short_name: string } | { short_name: string }[] | null };
type SearchSchool = { id: string; name: string; short_name: string };
type SearchData = { posts: FeedPost[]; people: SearchPerson[]; schools: SearchSchool[] };

function SearchResults({ q, data, isLoading }: { q: string; data: SearchData | undefined; isLoading: boolean }) {
  if (isLoading) return <div className="h-32 animate-pulse rounded-2xl bg-card/60" />;
  if (!data) return null;
  const empty = data.posts.length === 0 && data.people.length === 0 && data.schools.length === 0;
  return (
    <div className="space-y-5">
      {data.schools.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-primary">Schools</p>
          <div className="flex flex-wrap gap-2">
            {data.schools.map((s) => (
              <Link key={s.id} to="/school/$schoolId" params={{ schoolId: s.id }} className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs hover:border-primary/60">
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      )}
      {data.people.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-primary">People</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.people.map((p) => {
              const s = Array.isArray(p.school) ? p.school[0] : p.school;
              return (
                <Link key={p.id} to="/u/$id" params={{ id: p.id }} className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-2 hover:border-primary/50">
                  <Avatar className="h-8 w-8"><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{initials(p.display_name)}</AvatarFallback></Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.display_name ?? "Student"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{s?.short_name ?? ""}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
      {data.posts.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-primary">Posts</p>
          <div className="space-y-3">
            {data.posts.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        </div>
      )}
      {empty && (
        <p className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          No matches for "{q}".
        </p>
      )}
    </div>
  );
}

function SuggestedPeople({ people }: { people: Array<{ id: string; display_name: string | null; avatar_url: string | null; school: { short_name: string } | { short_name: string }[] | null }> }) {
  const { user } = useAuthUser();
  const qc = useQueryClient();
  const connect = useMutation({
    mutationFn: async (otherId: string) => {
      if (!user) throw new Error("Sign in");
      const { error } = await supabase.from("connections").insert({ requester_id: user.id, addressee_id: otherId, status: "pending" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request sent");
      qc.invalidateQueries({ queryKey: ["my-connections-ids"] });
      qc.invalidateQueries({ queryKey: ["connections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (people.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
        <Sparkles className="h-3.5 w-3.5" /> People you may know
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto pb-2">
        {people.map((p) => {
          const school = Array.isArray(p.school) ? p.school[0] : p.school;
          return (
            <div key={p.id} className="w-40 shrink-0 rounded-2xl border border-border/60 bg-card p-3 text-center">
              <Link to="/u/$id" params={{ id: p.id }} className="block">
                <Avatar className="mx-auto h-12 w-12"><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{initials(p.display_name)}</AvatarFallback></Avatar>
                <p className="mt-2 truncate text-sm font-medium">{p.display_name ?? "Student"}</p>
                <p className="truncate text-[11px] text-muted-foreground">{school?.short_name ?? ""}</p>
              </Link>
              <Button size="sm" className="mt-2 h-7 w-full brand-gradient text-xs text-primary-foreground" disabled={connect.isPending} onClick={() => connect.mutate(p.id)}>
                Connect
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
