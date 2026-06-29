import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/profile";
import { formatPoints } from "@/lib/campoints";
import { Trophy, Flame, Coins } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const topQ = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campoints_balances")
        .select("user_id, balance, lifetime_earned, user:profiles!campoints_balances_user_id_fkey(id, display_name, avatar_url, school:schools(short_name))")
        .order("balance", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const streakQ = useQuery({
    queryKey: ["streak-top"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_checkins")
        .select("user_id, streak, user:profiles!daily_checkins_user_id_fkey(id, display_name, avatar_url)")
        .order("streak", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <div className="mb-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
          <Trophy className="h-4 w-4" /> Leaderboard
        </div>
        <h1 className="mt-1 font-display text-3xl">Top Campoints earners</h1>
        <p className="text-sm text-muted-foreground">Post, engage, refer friends. Climb the board, cash out.</p>
      </div>

      {(streakQ.data?.length ?? 0) > 0 && (
        <section className="mb-6">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
            <Flame className="h-3.5 w-3.5" /> Streak spotlight
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto pb-2">
            {streakQ.data!.map((s) => {
              const u = Array.isArray(s.user) ? s.user[0] : s.user;
              return (
                <Link key={s.user_id} to="/u/$id" params={{ id: u?.id ?? "" }} className="w-32 shrink-0 rounded-2xl border border-border/60 bg-card p-3 text-center hover:border-primary/50">
                  <Avatar className="mx-auto h-12 w-12">
                    <AvatarImage src={u?.avatar_url ?? undefined} />
                    <AvatarFallback>{initials(u?.display_name)}</AvatarFallback>
                  </Avatar>
                  <p className="mt-2 truncate text-xs font-medium">{u?.display_name ?? "Student"}</p>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-primary">
                    <Flame className="h-3 w-3" />{s.streak}d
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <ol className="space-y-1.5">
        {(topQ.data ?? []).map((row, i) => {
          const u = Array.isArray(row.user) ? row.user[0] : row.user;
          const school = u ? (Array.isArray(u.school) ? u.school[0] : u.school) : null;
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
          return (
            <Link
              key={row.user_id}
              to="/u/$id"
              params={{ id: u?.id ?? "" }}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 hover:border-primary/50"
            >
              <span className="w-7 text-center font-display text-sm text-muted-foreground">{medal ?? i + 1}</span>
              <Avatar className="h-9 w-9">
                <AvatarImage src={u?.avatar_url ?? undefined} />
                <AvatarFallback>{initials(u?.display_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{u?.display_name ?? "Student"}</p>
                <p className="truncate text-xs text-muted-foreground">{school?.short_name ?? "—"}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                <Coins className="h-3.5 w-3.5" />{formatPoints(row.balance)}
              </span>
            </Link>
          );
        })}
      </ol>
    </AppShell>
  );
}
