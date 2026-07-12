import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- helpers (server-only) ----------
async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

async function award(userId: string, reason: string, delta: number, refType?: string, refId?: string, meta?: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const args: Record<string, unknown> = { _user: userId, _reason: reason, _delta: delta, _meta: meta ?? {} };
  if (refType) args._ref_type = refType;
  if (refId) args._ref_id = refId;
  const { data } = await supabaseAdmin.rpc("award_campoints", args as never);
  return (data as number) ?? 0;
}

// ---------- ambassador status for current user ----------
export const getMyAmbassadorStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: ambassador }, { data: application }] = await Promise.all([
      supabase.from("ambassadors").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("ambassador_applications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    return { ambassador, application };
  });

// ---------- apply for ambassador ----------
export const applyForAmbassador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { motivation: string; socials?: Record<string, string>; scope_type?: "school" | "faculty" | "department" | "hostel"; scope_id?: string | null; region?: string | null }) =>
    z.object({
      motivation: z.string().trim().min(30, "Tell us a bit more (30+ characters)").max(2000),
      socials: z.record(z.string(), z.string()).optional().default({}),
      scope_type: z.enum(["school", "faculty", "department", "hostel"]).optional().default("school"),
      scope_id: z.string().uuid().nullable().optional(),
      region: z.string().max(120).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Block if already an active ambassador
    const { data: existingAmb } = await supabase.from("ambassadors").select("user_id, status").eq("user_id", userId).maybeSingle();
    if (existingAmb && existingAmb.status === "active") return { ok: false, reason: "already_ambassador" };

    // Resolve scope_id and derive school_id
    let scopeId = data.scope_id ?? null;
    const { data: profile } = await supabase.from("profiles").select("primary_school_id").eq("id", userId).maybeSingle();
    if (data.scope_type === "school" && !scopeId) scopeId = profile?.primary_school_id ?? null;
    if (!scopeId && data.scope_type !== "hostel") return { ok: false, reason: "scope_required" };

    // school_id: for school scope it's the scope itself; for sub-scopes we resolve via helper
    let schoolId: string | null = null;
    if (data.scope_type === "school") {
      schoolId = scopeId;
    } else if (data.scope_type === "hostel") {
      schoolId = profile?.primary_school_id ?? null;
    } else if (scopeId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: sid } = await supabaseAdmin.rpc("resolve_school_id", { _scope_type: data.scope_type, _scope_id: scopeId });
      schoolId = (sid as string | null) ?? null;
    }
    if (data.scope_type !== "school" && !schoolId) return { ok: false, reason: "scope_required" };

    const { error } = await supabase.from("ambassador_applications").insert({
      user_id: userId,
      motivation: data.motivation,
      socials: data.socials ?? {},
      scope_type: data.scope_type,
      scope_id: scopeId,
      school_id: schoolId,
      region: data.region ?? null,
    });
    if (error) {
      if (error.code === "23505") return { ok: false, reason: "pending_exists" };
      throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------- ambassador dashboard ----------
export const getMyAmbassadorDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ambassador } = await supabase.from("ambassadors").select("*").eq("user_id", userId).maybeSingle();
    if (!ambassador || ambassador.status !== "active") {
      return { active: false as const };
    }

    const [
      { data: campaigns },
      { data: tasks },
      { data: completions },
      { data: announcements },
      { data: assets },
      { count: verifiedReferrals },
      { count: signups30d },
    ] = await Promise.all([
      supabase.from("ambassador_campaigns").select("*").eq("ambassador_id", userId).order("created_at", { ascending: false }),
      supabase.from("ambassador_tasks").select("*").eq("active", true).order("created_at", { ascending: false }).limit(50),
      supabase.from("ambassador_task_completions").select("*").eq("ambassador_id", userId),
      supabase.from("ambassador_announcements").select("*").order("published_at", { ascending: false }).limit(20),
      supabase.from("ambassador_assets").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("referred_by", userId),
      supabase.from("signup_attributions").select("id", { count: "exact", head: true }).eq("referrer_id", userId).gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString()),
    ]);

    // Active users: referred profiles that posted in last 30 days
    const { data: myReferrals } = await supabase.from("profiles").select("id").eq("referred_by", userId);
    const referralIds = (myReferrals ?? []).map(r => r.id);
    let activeUsers = 0;
    if (referralIds.length) {
      const { data: activePosters } = await supabaseAdmin
        .from("posts")
        .select("author_id")
        .in("author_id", referralIds)
        .gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString());
      activeUsers = new Set((activePosters ?? []).map(p => p.author_id)).size;
    }

    // Rankings (based on verified referrals count)
    let campusRank: number | null = null;
    let nationalRank: number | null = null;
    if (ambassador.scope_type === "school" && ambassador.scope_id) {
      const { data: schoolProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, primary_school_id")
        .eq("primary_school_id", ambassador.scope_id);
      const inSchoolIds = new Set((schoolProfiles ?? []).map(p => p.id));
      const { data: leaders } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" }); // no-op call to keep type
      void leaders;
      // Count referrals per user among users in this school
      const { data: refCounts } = await supabaseAdmin
        .from("profiles")
        .select("referred_by")
        .in("id", Array.from(inSchoolIds));
      const map = new Map<string, number>();
      (refCounts ?? []).forEach(r => { if (r.referred_by) map.set(r.referred_by, (map.get(r.referred_by) ?? 0) + 1); });
      const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
      const idx = sorted.findIndex(([id]) => id === userId);
      campusRank = idx >= 0 ? idx + 1 : null;
    }
    // National rank across all ambassadors
    const { data: allAmb } = await supabaseAdmin.from("ambassadors").select("user_id").eq("status", "active");
    const ambIds = (allAmb ?? []).map(a => a.user_id);
    if (ambIds.length) {
      const { data: allRefs } = await supabaseAdmin.from("profiles").select("referred_by").in("referred_by", ambIds);
      const map = new Map<string, number>();
      (allRefs ?? []).forEach(r => { if (r.referred_by) map.set(r.referred_by, (map.get(r.referred_by) ?? 0) + 1); });
      const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
      const idx = sorted.findIndex(([id]) => id === userId);
      nationalRank = idx >= 0 ? idx + 1 : null;
    }

    return {
      active: true as const,
      ambassador,
      campaigns: campaigns ?? [],
      tasks: tasks ?? [],
      completions: completions ?? [],
      announcements: announcements ?? [],
      assets: assets ?? [],
      metrics: {
        verifiedReferrals: verifiedReferrals ?? 0,
        activeUsers,
        signups30d: signups30d ?? 0,
        campusRank,
        nationalRank,
      },
    };
  });

// ---------- create campaign code ----------
export const createAmbassadorCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; code: string; landing_path?: string }) =>
    z.object({
      name: z.string().trim().min(2).max(80),
      code: z.string().trim().min(4).max(16).regex(/^[A-Z0-9]+$/, "Uppercase letters and digits only"),
      landing_path: z.string().max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Must be active ambassador
    const { data: amb } = await supabase.from("ambassadors").select("status").eq("user_id", userId).maybeSingle();
    if (!amb || amb.status !== "active") throw new Error("Only active ambassadors can create campaigns");

    // Ensure code is unique across personal referral codes too
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: personalClash }, { data: campaignClash }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id").eq("referral_code", data.code).maybeSingle(),
      supabaseAdmin.from("ambassador_campaigns").select("id").eq("code", data.code).maybeSingle(),
    ]);
    if (personalClash || campaignClash) throw new Error("That code is already in use — pick another.");

    const { data: row, error } = await supabase.from("ambassador_campaigns").insert({
      ambassador_id: userId,
      name: data.name,
      code: data.code,
      landing_path: data.landing_path ?? "/",
    }).select("*").single();
    if (error) throw new Error(error.message);
    return { ok: true, campaign: row };
  });

// ---------- submit task completion ----------
export const submitAmbassadorTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { taskId: string; evidenceUrl?: string; notes?: string }) =>
    z.object({
      taskId: z.string().uuid(),
      evidenceUrl: z.string().url().optional(),
      notes: z.string().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: amb } = await supabase.from("ambassadors").select("status").eq("user_id", userId).maybeSingle();
    if (!amb || amb.status !== "active") throw new Error("Only active ambassadors can submit tasks");
    const { error } = await supabase.from("ambassador_task_completions").insert({
      task_id: data.taskId,
      ambassador_id: userId,
      evidence_url: data.evidenceUrl ?? null,
      notes: data.notes ?? null,
    });
    if (error) {
      if (error.code === "23505") return { ok: false, reason: "already_submitted" };
      throw new Error(error.message);
    }
    return { ok: true };
  });

// ============================================================
// ADMIN
// ============================================================

export const adminListApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ambassador_applications")
      .select("*, applicant:profiles!ambassador_applications_user_id_fkey(id, display_name, avatar_url, primary_school_id), school:schools(id, short_name, name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminListAmbassadors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ambassadors")
      .select("*, user:profiles!ambassadors_user_id_fkey(id, display_name, avatar_url), school:schools(id, short_name, name)")
      .order("approved_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminReviewApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { applicationId: string; decision: "approve" | "reject"; tier?: "ambassador" | "senior" | "regional_lead"; notes?: string }) =>
    z.object({
      applicationId: z.string().uuid(),
      decision: z.enum(["approve", "reject"]),
      tier: z.enum(["ambassador", "senior", "regional_lead"]).optional().default("ambassador"),
      notes: z.string().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: app, error: appErr } = await supabaseAdmin.from("ambassador_applications").select("*").eq("id", data.applicationId).maybeSingle();
    if (appErr) throw new Error(appErr.message);
    if (!app) throw new Error("Application not found");

    if (data.decision === "reject") {
      const { error } = await supabaseAdmin.from("ambassador_applications").update({
        status: "rejected", reviewer_id: context.userId, review_notes: data.notes ?? null,
      }).eq("id", app.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    // Approve → upsert into ambassadors, ensure role
    const { error: ambErr } = await supabaseAdmin.from("ambassadors").upsert({
      user_id: app.user_id,
      tier: data.tier ?? "ambassador",
      scope_type: app.scope_type,
      scope_id: app.scope_id,
      school_id: app.school_id,
      region: app.region,
      status: "active",
      approved_by: context.userId,
      approved_at: new Date().toISOString(),
      suspended_at: null,
      suspend_reason: null,
    }, { onConflict: "user_id" });
    if (ambErr) throw new Error(ambErr.message);

    const { error: appUpErr } = await supabaseAdmin.from("ambassador_applications").update({
      status: "approved", reviewer_id: context.userId, review_notes: data.notes ?? null,
    }).eq("id", app.id);
    if (appUpErr) throw new Error(appUpErr.message);

    // Welcome bonus
    await award(app.user_id, "ambassador_bonus", 500, "ambassador", app.user_id, { event: "approved" });
    return { ok: true };
  });

    const { error: appUpErr } = await supabaseAdmin.from("ambassador_applications").update({
      status: "approved", reviewer_id: context.userId, review_notes: data.notes ?? null,
    }).eq("id", app.id);
    if (appUpErr) throw new Error(appUpErr.message);

    // Welcome bonus
    await award(app.user_id, "ambassador_bonus", 500, "ambassador", app.user_id, { event: "approved" });
    return { ok: true };
  });

export const adminSetAmbassadorTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; tier: "ambassador" | "senior" | "regional_lead" }) =>
    z.object({ userId: z.string().uuid(), tier: z.enum(["ambassador", "senior", "regional_lead"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ambassadors").update({ tier: data.tier }).eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetAmbassadorStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; status: "active" | "suspended"; reason?: string }) =>
    z.object({ userId: z.string().uuid(), status: z.enum(["active", "suspended"]), reason: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch = data.status === "suspended"
      ? { status: data.status, suspended_at: new Date().toISOString(), suspend_reason: data.reason ?? null }
      : { status: data.status, suspended_at: null, suspend_reason: null };
    const { error } = await supabaseAdmin.from("ambassadors").update(patch).eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminPublishAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; body: string }) =>
    z.object({ title: z.string().trim().min(2).max(160), body: z.string().trim().min(2).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ambassador_announcements").insert({
      title: data.title, body: data.body, author_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminCreateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; description: string; reward_points: number; ends_at?: string | null }) =>
    z.object({
      title: z.string().trim().min(2).max(160),
      description: z.string().trim().min(2).max(4000),
      reward_points: z.number().int().min(0).max(100_000),
      ends_at: z.string().datetime().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ambassador_tasks").insert({
      title: data.title,
      description: data.description,
      reward_points: data.reward_points,
      ends_at: data.ends_at ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminReviewTaskCompletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { completionId: string; decision: "approve" | "reject" }) =>
    z.object({ completionId: z.string().uuid(), decision: z.enum(["approve", "reject"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: comp, error: cErr } = await supabaseAdmin
      .from("ambassador_task_completions").select("*, task:ambassador_tasks(id, title, reward_points)").eq("id", data.completionId).maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!comp) throw new Error("Completion not found");

    const { error } = await supabaseAdmin.from("ambassador_task_completions").update({
      status: data.decision === "approve" ? "approved" : "rejected",
      reviewer_id: context.userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", comp.id);
    if (error) throw new Error(error.message);

    if (data.decision === "approve") {
      type TaskInfo = { id: string; title: string; reward_points: number } | null;
      const rawTask = (comp as { task?: TaskInfo | TaskInfo[] }).task;
      const task = Array.isArray(rawTask) ? rawTask[0] : rawTask;
      const reward = task?.reward_points ?? 0;
      if (reward > 0) {
        await award(comp.ambassador_id, "ambassador_task_reward", reward, "task", comp.task_id, { title: task?.title });
      }
    }
    return { ok: true };
  });
