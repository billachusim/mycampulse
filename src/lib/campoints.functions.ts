import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { POINTS_PER_NAIRA, MIN_CASHOUT_POINTS, MIN_AIRTIME_POINTS, NETWORKS } from "./campoints";

// --- helpers ---
function todayLagos(): string {
  // YYYY-MM-DD in Africa/Lagos
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date());
}

async function award(userId: string, reason: string, delta: number, refType?: string, refId?: string, meta?: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("award_campoints", {
    _user: userId,
    _reason: reason as never,
    _delta: delta,
    _ref_type: refType ?? null,
    _ref_id: refId ?? null,
    _meta: (meta ?? {}) as never,
  });
  if (error) throw new Error(error.message);
  return data ?? 0;
}

// --- claim daily check-in ---
export const claimDailyCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const day = todayLagos();
    const userId = context.userId;

    // already checked in?
    const { data: existing } = await supabaseAdmin
      .from("daily_checkins")
      .select("day, streak, awarded")
      .eq("user_id", userId)
      .eq("day", day)
      .maybeSingle();
    if (existing) return { already: true, awarded: 0, streak: existing.streak };

    // figure streak from previous day
    const yesterday = new Date(day);
    yesterday.setDate(yesterday.getDate() - 1);
    const yDay = yesterday.toISOString().slice(0, 10);
    const { data: prev } = await supabaseAdmin
      .from("daily_checkins")
      .select("streak")
      .eq("user_id", userId)
      .eq("day", yDay)
      .maybeSingle();
    const streak = (prev?.streak ?? 0) + 1;

    const base = 5;
    let bonus = 0;
    if (streak % 30 === 0) bonus = 100;
    else if (streak % 7 === 0) bonus = 25;
    else if (streak % 3 === 0) bonus = 10;
    const awarded = base + bonus;

    const { error: insErr } = await supabaseAdmin
      .from("daily_checkins")
      .insert({ user_id: userId, day, streak, awarded });
    if (insErr) throw new Error(insErr.message);

    await award(userId, "daily_checkin", base, "checkin", undefined, { day });
    if (bonus > 0) await award(userId, "streak_bonus", bonus, "checkin", undefined, { day, streak });

    return { already: false, awarded, streak, bonus };
  });

// --- wallet snapshot ---
export const getMyWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [balanceRes, ledgerRes, profileRes, todayCheckinRes, referralsRes, redemptionsRes] = await Promise.all([
      supabase.from("campoints_balances").select("balance, lifetime_earned").eq("user_id", userId).maybeSingle(),
      supabase
        .from("campoints_ledger")
        .select("id, delta, reason, ref_type, created_at, meta")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase.from("profiles").select("referral_code, referred_by, avatar_url, bio, department_id").eq("id", userId).maybeSingle(),
      supabase.from("daily_checkins").select("day, streak").eq("user_id", userId).order("day", { ascending: false }).limit(1),
      supabase.from("profiles").select("id, display_name, avatar_url, created_at").eq("referred_by", userId).limit(50),
      supabase.from("redemptions").select("id, kind, amount_points, amount_naira, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
    ]);

    const today = todayLagos();
    const last = todayCheckinRes.data?.[0];
    const checkedInToday = last?.day === today;
    const streak = checkedInToday ? last?.streak ?? 0 : 0;

    return {
      balance: balanceRes.data?.balance ?? 0,
      lifetime: balanceRes.data?.lifetime_earned ?? 0,
      ledger: ledgerRes.data ?? [],
      referralCode: profileRes.data?.referral_code ?? null,
      profileComplete: !!(profileRes.data?.avatar_url && profileRes.data?.bio && profileRes.data?.department_id),
      checkedInToday,
      streak,
      referrals: referralsRes.data ?? [],
      redemptions: redemptionsRes.data ?? [],
    };
  });

// --- claim profile-complete bonus ---
export const claimProfileComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url, bio, department_id, primary_school_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.avatar_url || !profile?.bio || !profile?.department_id || !profile?.primary_school_id) {
      return { awarded: 0, reason: "incomplete" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("campoints_ledger")
      .select("id")
      .eq("user_id", userId)
      .eq("reason", "profile_complete")
      .limit(1)
      .maybeSingle();
    if (existing) return { awarded: 0, reason: "already" };
    await award(userId, "profile_complete", 50, "profile");
    return { awarded: 50, reason: "ok" };
  });

// --- apply referral code (during/after onboarding) ---
export const applyReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => z.object({ code: z.string().trim().min(4).max(16) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const code = data.code.toUpperCase();

    const { data: me } = await supabaseAdmin.from("profiles").select("referred_by").eq("id", userId).maybeSingle();
    if (me?.referred_by) return { ok: false, reason: "already" };

    const { data: referrer } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();
    if (!referrer) return { ok: false, reason: "not_found" };
    if (referrer.id === userId) return { ok: false, reason: "self" };

    const { error } = await supabaseAdmin.from("profiles").update({ referred_by: referrer.id }).eq("id", userId);
    if (error) throw new Error(error.message);

    // Referrer earns when this user first posts (trigger handles it). Also immediate qualification reward:
    await award(referrer.id, "referral_qualified", 200, "profile", userId);
    return { ok: true };
  });

// --- claim share bounty ---
export const claimShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string; channel?: string }) =>
    z.object({ postId: z.string().uuid(), channel: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    // dedupe per (post, sharer)
    const { data: existing } = await supabaseAdmin
      .from("share_clicks")
      .select("id")
      .eq("post_id", data.postId)
      .eq("sharer_id", userId)
      .maybeSingle();
    if (existing) return { awarded: 0, reason: "already" };
    const { error } = await supabaseAdmin
      .from("share_clicks")
      .insert({ post_id: data.postId, sharer_id: userId, channel: data.channel ?? null });
    if (error) throw new Error(error.message);
    const awarded = await award(userId, "share_click", 5, "post", data.postId, { channel: data.channel });
    return { awarded, reason: awarded ? "ok" : "capped" };
  });

// --- redeem airtime ---
export const redeemAirtime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { network: string; phone: string; amountNaira: number }) =>
    z
      .object({
        network: z.enum(NETWORKS),
        phone: z.string().regex(/^0\d{10}$/, "Use an 11-digit Nigerian number, e.g. 0803…"),
        amountNaira: z.number().int().min(100).max(20_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const points = data.amountNaira * POINTS_PER_NAIRA;
    if (points < MIN_AIRTIME_POINTS) throw new Error(`Minimum is ₦${MIN_AIRTIME_POINTS / POINTS_PER_NAIRA} airtime`);

    const { data: bal } = await supabaseAdmin
      .from("campoints_balances")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();
    if (!bal || bal.balance < points) throw new Error("Not enough Campoints");

    // Debit ledger first
    const { error: ledgerErr } = await supabaseAdmin
      .from("campoints_ledger")
      .insert({ user_id: userId, delta: -points, reason: "redemption_debit", ref_type: "redemption", meta: { kind: "airtime", network: data.network, phone: data.phone, naira: data.amountNaira } });
    if (ledgerErr) throw new Error(ledgerErr.message);

    const { data: redemption, error } = await supabaseAdmin
      .from("redemptions")
      .insert({
        user_id: userId,
        kind: "airtime",
        amount_points: points,
        amount_naira: data.amountNaira,
        payload: { network: data.network, phone: data.phone },
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // TODO: when VTU_API_KEY is set, call provider here and flip to 'paid' or 'failed'.
    return { ok: true, redemptionId: redemption.id, status: "pending" };
  });

// --- request cash out ---
export const requestCashOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { amountNaira: number; bankCode: string; accountNumber: string; accountName: string }) =>
    z
      .object({
        amountNaira: z.number().int().min(1000).max(50_000),
        bankCode: z.string().min(3).max(10),
        accountNumber: z.string().regex(/^\d{10}$/, "10-digit account number"),
        accountName: z.string().min(3).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const points = data.amountNaira * POINTS_PER_NAIRA;
    if (points < MIN_CASHOUT_POINTS) throw new Error(`Minimum cash-out is ₦${MIN_CASHOUT_POINTS / POINTS_PER_NAIRA}`);

    const { data: bal } = await supabaseAdmin
      .from("campoints_balances")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();
    if (!bal || bal.balance < points) throw new Error("Not enough Campoints");

    const { error: ledgerErr } = await supabaseAdmin
      .from("campoints_ledger")
      .insert({ user_id: userId, delta: -points, reason: "redemption_debit", ref_type: "redemption", meta: { kind: "cash", naira: data.amountNaira } });
    if (ledgerErr) throw new Error(ledgerErr.message);

    const { data: redemption, error } = await supabaseAdmin
      .from("redemptions")
      .insert({
        user_id: userId,
        kind: "cash",
        amount_points: points,
        amount_naira: data.amountNaira,
        payload: { bank_code: data.bankCode, account_number: data.accountNumber, account_name: data.accountName },
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, redemptionId: redemption.id, status: "pending" };
  });
