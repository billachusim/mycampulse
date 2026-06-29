import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Coins, Flame, Gift, Share2, Smartphone, Wallet, Copy, ChevronRight, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { claimDailyCheckin, getMyWallet, claimProfileComplete } from "@/lib/campoints.functions";
import { formatPoints, pointsToNaira } from "@/lib/campoints";
import { timeAgo, initials } from "@/lib/profile";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/wallet")({
  component: WalletPage,
});

const REASON_LABELS: Record<string, string> = {
  daily_checkin: "Daily check-in",
  streak_bonus: "Streak bonus",
  post: "Post created",
  comment: "Comment posted",
  like_received: "Like received",
  comment_received: "Comment received",
  referral_qualified: "Friend joined with your code",
  referral_first_post: "Your invite posted",
  share_click: "Shared a post",
  profile_complete: "Profile complete",
  quest: "Quest completed",
  redemption_debit: "Redeemed",
  redemption_refund: "Refund",
  admin_adjust: "Adjustment",
};

function WalletPage() {
  const qc = useQueryClient();
  const fetchWallet = useServerFn(getMyWallet);
  const claimCheckin = useServerFn(claimDailyCheckin);
  const claimProfile = useServerFn(claimProfileComplete);

  const wallet = useQuery({ queryKey: ["wallet"], queryFn: () => fetchWallet() });

  // Live balance updates: refetch on ledger inserts for this user.
  useEffect(() => {
    let userId: string | undefined;
    supabase.auth.getUser().then(({ data }) => {
      userId = data.user?.id;
      if (!userId) return;
      const ch = supabase
        .channel("wallet-" + userId)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "campoints_ledger", filter: `user_id=eq.${userId}` }, () => {
          qc.invalidateQueries({ queryKey: ["wallet"] });
        })
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    });
  }, [qc]);

  const checkin = useMutation({
    mutationFn: async () => claimCheckin(),
    onSuccess: (r) => {
      if (r.already) toast("Already checked in today — see you tomorrow.");
      else toast.success(`+${r.awarded} Campoints${r.bonus ? ` · ${r.bonus} streak bonus 🔥` : ""}`);
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const profileBonus = useMutation({
    mutationFn: async () => claimProfile(),
    onSuccess: (r) => {
      if (r.reason === "ok") toast.success(`+${r.awarded} Campoints — profile complete!`);
      else if (r.reason === "incomplete") toast("Add an avatar, bio, and department first.");
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });

  const copyReferral = async () => {
    if (!wallet.data?.referralCode) return;
    const link = `${window.location.origin}/auth?ref=${wallet.data.referralCode}`;
    await navigator.clipboard.writeText(link);
    toast.success("Invite link copied — share it with a coursemate.");
  };

  const w = wallet.data;
  const naira = pointsToNaira(w?.balance ?? 0);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Balance card */}
        <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6">
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full brand-gradient opacity-30 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary"><Coins className="h-4 w-4" /> Campoints</div>
            <div className="mt-2 flex items-baseline gap-3">
              <h1 className="font-display text-6xl leading-none">{formatPoints(w?.balance ?? 0)}</h1>
              <span className="text-sm text-muted-foreground">≈ ₦{formatPoints(naira)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Lifetime earned: {formatPoints(w?.lifetime ?? 0)}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => checkin.mutate()} disabled={checkin.isPending || w?.checkedInToday} className="brand-gradient text-primary-foreground">
                <Flame className="mr-1.5 h-4 w-4" />
                {w?.checkedInToday ? `Checked in · ${w.streak}-day streak` : "Claim daily +5"}
              </Button>
              <Link to="/redeem/airtime" className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-4 py-2 text-sm hover:bg-secondary">
                <Smartphone className="h-4 w-4" /> Airtime / Data
              </Link>
              <Link to="/redeem/cash" className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-4 py-2 text-sm hover:bg-secondary">
                <Wallet className="h-4 w-4" /> Cash out
              </Link>
            </div>
          </div>
        </section>

        {/* Referral */}
        <section className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary"><Gift className="h-4 w-4" /> Invite & earn</div>
          <h2 className="mt-1 font-display text-2xl">Bring your campus on Campulse</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Get <span className="text-foreground">200 Campoints</span> when a friend signs up with your code, and a <span className="text-foreground">50 Campoints</span> bonus the first time they post.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-secondary px-3 py-2 font-mono text-base tracking-widest">{w?.referralCode ?? "—"}</code>
            <Button variant="secondary" onClick={copyReferral}><Copy className="mr-1.5 h-4 w-4" /> Copy invite link</Button>
            <span className="text-xs text-muted-foreground">{w?.referrals.length ?? 0} joined</span>
          </div>
          {w && w.referrals.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {w.referrals.slice(0, 8).map((r) => (
                <Link key={r.id} to="/u/$id" params={{ id: r.id }} className="flex items-center gap-2 rounded-full border border-border/60 bg-background px-2 py-1 text-xs hover:bg-secondary">
                  <Avatar className="h-5 w-5"><AvatarImage src={r.avatar_url ?? undefined} /><AvatarFallback className="text-[10px]">{initials(r.display_name)}</AvatarFallback></Avatar>
                  {r.display_name}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Quests */}
        <section className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary"><Sparkles className="h-4 w-4" /> Quests</div>
          <h2 className="mt-1 font-display text-2xl">Easy ways to earn</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <QuestRow done={w?.checkedInToday} label="Check in today" reward="+5" />
            <QuestRow
              done={w?.profileComplete}
              label="Complete your profile (avatar + bio + department)"
              reward="+50"
              cta={
                <Button size="sm" variant="secondary" onClick={() => profileBonus.mutate()} disabled={profileBonus.isPending}>
                  Claim
                </Button>
              }
            />
            <QuestRow label="Post something on your campus" reward="+10 / post" />
            <QuestRow label="Comment on a coursemate's post" reward="+2 / comment" />
            <QuestRow label="Share a post to WhatsApp" reward={<span className="inline-flex items-center gap-1"><Share2 className="h-3 w-3" /> +5</span>} />
            <QuestRow label="Invite a friend who posts" reward="+200 then +50" />
          </ul>
        </section>

        {/* Recent history */}
        <section className="rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="mb-3 font-display text-xl">Recent activity</h2>
          <div className="space-y-1">
            {w?.ledger.length === 0 && (
              <p className="text-sm text-muted-foreground">No activity yet — check in to start earning.</p>
            )}
            {w?.ledger.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-secondary/50">
                <div className="min-w-0">
                  <div className="truncate">{REASON_LABELS[row.reason] ?? row.reason}</div>
                  <div className="text-xs text-muted-foreground">{timeAgo(row.created_at)}</div>
                </div>
                <div className={`font-mono text-sm ${row.delta >= 0 ? "text-primary" : "text-destructive"}`}>
                  {row.delta >= 0 ? "+" : ""}{formatPoints(row.delta)}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Redemptions */}
        {w && w.redemptions.length > 0 && (
          <section className="rounded-2xl border border-border/60 bg-card p-5">
            <h2 className="mb-3 font-display text-xl">Redemptions</h2>
            <div className="space-y-2">
              {w.redemptions.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-sm">
                  <div>
                    <div className="capitalize">{r.kind} · ₦{formatPoints(r.amount_naira)}</div>
                    <div className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    r.status === "paid" ? "bg-primary/20 text-primary" :
                    r.status === "rejected" || r.status === "failed" ? "bg-destructive/20 text-destructive" :
                    "bg-secondary"}`}>{r.status}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function QuestRow({ label, reward, done, cta }: { label: string; reward: React.ReactNode; done?: boolean; cta?: React.ReactNode }) {
  return (
    <li className={`flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background px-3 py-2 ${done ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2">
        <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${done ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
          {done ? "✓" : <ChevronRight className="h-3 w-3" />}
        </span>
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-primary">{reward}</span>
        {cta}
      </div>
    </li>
  );
}
