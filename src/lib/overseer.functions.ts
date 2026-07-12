import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- guard ----------
async function assertOwner(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (!data) throw new Error("Forbidden");
}

async function audit(
  actorId: string,
  action: string,
  targetKind?: string | null,
  targetId?: string | null,
  meta?: Record<string, unknown>,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    target_kind: targetKind ?? null,
    target_id: targetId ?? null,
    meta: (meta ?? {}) as never,
  });
}

const PAGE = 10;

// ---------- entry check ----------
export const overseerCanEnter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.rpc("has_role", { _user_id: context.userId, _role: "owner" });
    return { ok: !!data };
  });

// ---------- pulse ----------
export const overseerPulse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [users24h, posts24h, activeCampaigns, openReports, pendingRedemptions, totalUsers] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { head: true, count: "exact" }).gte("created_at", since),
      supabaseAdmin.from("posts").select("id", { head: true, count: "exact" }).gte("created_at", since),
      supabaseAdmin.from("ambassador_campaigns").select("id", { head: true, count: "exact" }).eq("active", true),
      supabaseAdmin.from("reports").select("id", { head: true, count: "exact" }).eq("status", "open"),
      supabaseAdmin.from("redemptions").select("id", { head: true, count: "exact" }).eq("status", "pending"),
      supabaseAdmin.from("profiles").select("id", { head: true, count: "exact" }),
    ]);

    return {
      users24h: users24h.count ?? 0,
      posts24h: posts24h.count ?? 0,
      activeCampaigns: activeCampaigns.count ?? 0,
      openReports: openReports.count ?? 0,
      pendingRedemptions: pendingRedemptions.count ?? 0,
      totalUsers: totalUsers.count ?? 0,
    };
  });

// ---------- users ----------
export const overseerListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q?: string; cursor?: string | null }) =>
    z.object({ q: z.string().max(80).optional(), cursor: z.string().nullish() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("profiles")
      .select("id, display_name, handle, avatar_url, primary_school_id, verified, created_at")
      .order("created_at", { ascending: false })
      .limit(PAGE);
    if (data.cursor) q = q.lt("created_at", data.cursor);
    if (data.q && data.q.trim()) {
      const term = `%${data.q.trim()}%`;
      q = q.or(`display_name.ilike.${term},handle.ilike.${term}`);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const overseerGetUserDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile }, { data: roles }, { data: balance }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, display_name, handle, avatar_url, primary_school_id, verified, phone, created_at").eq("id", data.userId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId),
      supabaseAdmin.from("campoints_balances").select("balance, lifetime_earned").eq("user_id", data.userId).maybeSingle(),
    ]);
    return { profile, roles: (roles ?? []).map((r) => r.role), balance };
  });

export const overseerAdjustCampoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; delta: number; note?: string }) =>
    z.object({ userId: z.string().uuid(), delta: z.number().int().min(-100000).max(100000), note: z.string().max(300).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("award_campoints", {
      _user: data.userId,
      _reason: "admin_adjust",
      _delta: data.delta,
      _meta: { by: context.userId, note: data.note ?? null },
    } as never);
    await audit(context.userId, "campoints.adjust", "user", data.userId, { delta: data.delta, note: data.note });
    return { ok: true };
  });

export const overseerSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; role: "admin" | "moderator"; grant: boolean }) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["admin", "moderator"]), grant: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      await supabaseAdmin.from("user_roles").upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
    }
    await audit(context.userId, data.grant ? "role.grant" : "role.revoke", "user", data.userId, { role: data.role });
    return { ok: true };
  });

// ---------- posts ----------
export const overseerListPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cursor?: string | null; hiddenOnly?: boolean }) =>
    z.object({ cursor: z.string().nullish(), hiddenOnly: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("posts")
      .select("id, body, hidden, like_count, comment_count, created_at, author:profiles!posts_author_id_fkey(id, display_name, handle)")
      .order("created_at", { ascending: false })
      .limit(PAGE);
    if (data.cursor) q = q.lt("created_at", data.cursor);
    if (data.hiddenOnly) q = q.eq("hidden", true);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const overseerSetPostHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string; hidden: boolean }) =>
    z.object({ postId: z.string().uuid(), hidden: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("posts").update({ hidden: data.hidden }).eq("id", data.postId);
    await audit(context.userId, data.hidden ? "post.hide" : "post.unhide", "post", data.postId);
    return { ok: true };
  });

export const overseerDeletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string }) => z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("posts").delete().eq("id", data.postId);
    await audit(context.userId, "post.delete", "post", data.postId);
    return { ok: true };
  });

// ---------- comments ----------
export const overseerListComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cursor?: string | null }) => z.object({ cursor: z.string().nullish() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("comments")
      .select("id, body, post_id, created_at, author:profiles!comments_author_id_fkey(id, display_name, handle)")
      .order("created_at", { ascending: false })
      .limit(PAGE);
    if (data.cursor) q = q.lt("created_at", data.cursor);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const overseerDeleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { commentId: string }) => z.object({ commentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("comments").delete().eq("id", data.commentId);
    await audit(context.userId, "comment.delete", "comment", data.commentId);
    return { ok: true };
  });

// ---------- events ----------
export const overseerListEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cursor?: string | null; status?: string }) =>
    z.object({ cursor: z.string().nullish(), status: z.string().max(30).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("events")
      .select("id, title, status, starts_at, location, rsvp_count, created_at, host:profiles!events_host_id_fkey(id, display_name)")
      .order("created_at", { ascending: false })
      .limit(PAGE);
    if (data.cursor) q = q.lt("created_at", data.cursor);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const overseerSetEventStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { eventId: string; status: string }) =>
    z.object({ eventId: z.string().uuid(), status: z.string().max(30) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("events").update({ status: data.status }).eq("id", data.eventId);
    await audit(context.userId, "event.status", "event", data.eventId, { status: data.status });
    return { ok: true };
  });

export const overseerDeleteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { eventId: string }) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("events").delete().eq("id", data.eventId);
    await audit(context.userId, "event.delete", "event", data.eventId);
    return { ok: true };
  });

// ---------- listings ----------
export const overseerListListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cursor?: string | null; status?: string }) =>
    z.object({ cursor: z.string().nullish(), status: z.string().max(30).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("marketplace_items")
      .select("id, title, price_naira, status, category, created_at, seller:profiles!marketplace_items_seller_id_fkey(id, display_name)")
      .order("created_at", { ascending: false })
      .limit(PAGE);
    if (data.cursor) q = q.lt("created_at", data.cursor);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const overseerSetListingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { listingId: string; status: string }) =>
    z.object({ listingId: z.string().uuid(), status: z.string().max(30) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("marketplace_items").update({ status: data.status }).eq("id", data.listingId);
    await audit(context.userId, "listing.status", "listing", data.listingId, { status: data.status });
    return { ok: true };
  });

export const overseerDeleteListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { listingId: string }) => z.object({ listingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("marketplace_items").delete().eq("id", data.listingId);
    await audit(context.userId, "listing.delete", "listing", data.listingId);
    return { ok: true };
  });

// ---------- ambassadors + campaigns ----------
export const overseerListAmbassadors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cursor?: string | null; scope?: "school" | "faculty" | "department" | "hostel" }) =>
    z.object({ cursor: z.string().nullish(), scope: z.enum(["school", "faculty", "department", "hostel"]).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("ambassadors")
      .select("user_id, tier, status, scope_type, scope_id, school_id, created_at, user:profiles!ambassadors_user_id_fkey(id, display_name, handle)")
      .order("created_at", { ascending: false })
      .limit(PAGE);
    if (data.cursor) q = q.lt("created_at", data.cursor);
    if (data.scope) q = q.eq("scope_type", data.scope);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const overseerSetAmbassadorStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; status: "active" | "suspended" }) =>
    z.object({ userId: z.string().uuid(), status: z.enum(["active", "suspended"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ambassadors").update({ status: data.status }).eq("user_id", data.userId);
    await audit(context.userId, "ambassador.status", "user", data.userId, { status: data.status });
    return { ok: true };
  });

export const overseerListCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cursor?: string | null; activeOnly?: boolean }) =>
    z.object({ cursor: z.string().nullish(), activeOnly: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("ambassador_campaigns")
      .select("id, code, name, landing_path, active, created_at, ambassador_id")
      .order("created_at", { ascending: false })
      .limit(PAGE);
    if (data.cursor) q = q.lt("created_at", data.cursor);
    if (data.activeOnly) q = q.eq("active", true);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const overseerSetCampaignActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId: string; active: boolean }) =>
    z.object({ campaignId: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ambassador_campaigns").update({ active: data.active }).eq("id", data.campaignId);
    await audit(context.userId, "campaign.setActive", "campaign", data.campaignId, { active: data.active });
    return { ok: true };
  });

// ---------- redemptions ----------
export const overseerListRedemptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cursor?: string | null; status?: "pending" | "approved" | "paid" | "failed" | "rejected" }) =>
    z.object({ cursor: z.string().nullish(), status: z.enum(["pending", "approved", "paid", "failed", "rejected"]).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("redemptions")
      .select("id, kind, amount_points, amount_naira, status, created_at, payload, user:profiles!redemptions_user_id_profiles_fkey(id, display_name, handle)")
      .order("created_at", { ascending: false })
      .limit(PAGE);
    if (data.cursor) q = q.lt("created_at", data.cursor);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const overseerSetRedemptionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { redemptionId: string; status: "approved" | "paid" | "rejected" | "failed"; note?: string }) =>
    z.object({
      redemptionId: z.string().uuid(),
      status: z.enum(["approved", "paid", "rejected", "failed"]),
      note: z.string().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("redemptions").update({ status: data.status }).eq("id", data.redemptionId);
    await audit(context.userId, "redemption.status", "redemption", data.redemptionId, { status: data.status, note: data.note });
    return { ok: true };
  });

// ---------- reports ----------
export const overseerListReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cursor?: string | null; status?: string }) =>
    z.object({ cursor: z.string().nullish(), status: z.string().max(30).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("reports")
      .select("id, target_kind, target_id, reason, status, created_at, reporter:profiles!reports_reporter_id_profiles_fkey(id, display_name)")
      .order("created_at", { ascending: false })
      .limit(PAGE);
    if (data.cursor) q = q.lt("created_at", data.cursor);
    q = q.eq("status", (data.status ?? "open") as never);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const overseerResolveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string; status: "resolved" | "dismissed" }) =>
    z.object({ reportId: z.string().uuid(), status: z.enum(["resolved", "dismissed"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("reports").update({ status: data.status }).eq("id", data.reportId);
    await audit(context.userId, "report.resolve", "report", data.reportId, { status: data.status });
    return { ok: true };
  });

// ---------- campoints ledger ----------
export const overseerListLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cursor?: string | null; userId?: string; reason?: string }) =>
    z.object({ cursor: z.string().nullish(), userId: z.string().uuid().optional(), reason: z.string().max(60).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("campoints_ledger")
      .select("id, user_id, delta, reason, ref_type, ref_id, created_at, meta")
      .order("created_at", { ascending: false })
      .limit(PAGE);
    if (data.cursor) q = q.lt("created_at", data.cursor);
    if (data.userId) q = q.eq("user_id", data.userId);
    if (data.reason) q = q.eq("reason", data.reason as never);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

// ---------- audit trail ----------
export const overseerListAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cursor?: string | null }) => z.object({ cursor: z.string().nullish() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("admin_audit_log")
      .select("id, actor_id, action, target_kind, target_id, meta, created_at")
      .order("created_at", { ascending: false })
      .limit(PAGE);
    if (data.cursor) q = q.lt("created_at", data.cursor);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });
