import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { timeAgo } from "@/lib/profile";
import { formatPoints } from "@/lib/campoints";
import {
  adminCreateTask,
  adminListAmbassadors,
  adminListApplications,
  adminPublishAnnouncement,
  adminReviewApplication,
  adminSetAmbassadorStatus,
  adminSetAmbassadorTier,
} from "@/lib/ambassador.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
    if (!role) throw redirect({ to: "/home" });
  },
  component: AdminPage,
});

type Tab = "reports" | "redemptions" | "events" | "listings" | "ambassadors";

function AdminPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("reports");

  const reports = useQuery({
    queryKey: ["admin-reports"],
    enabled: tab === "reports",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, target_kind, target_id, reason, status, created_at, reporter:profiles!reports_reporter_id_profiles_fkey(display_name)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const redemptions = useQuery({
    queryKey: ["admin-redemptions"],
    enabled: tab === "redemptions",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("redemptions")
        .select("id, kind, amount_points, amount_naira, status, created_at, payload, user:profiles!redemptions_user_id_profiles_fkey(id, display_name, avatar_url)")
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const allEvents = useQuery({
    queryKey: ["admin-events"],
    enabled: tab === "events",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, status, starts_at, location, cover_url, rsvp_count, host:profiles!events_host_id_fkey(id, display_name), school:schools(short_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const allListings = useQuery({
    queryKey: ["admin-listings"],
    enabled: tab === "listings",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_items")
        .select("id, title, status, price_naira, image_url, category, seller:profiles!marketplace_items_seller_id_fkey(id, display_name), school:schools(short_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const setEventStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "hidden" }) => {
      const { error } = await supabase.from("events").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.status === "hidden" ? "Event hidden" : "Event restored");
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Event deleted"); queryClient.invalidateQueries({ queryKey: ["admin-events"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setListingStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "hidden" | "sold" }) => {
      const { error } = await supabase.from("marketplace_items").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.status === "hidden" ? "Listing hidden" : vars.status === "sold" ? "Marked sold" : "Listing restored");
      queryClient.invalidateQueries({ queryKey: ["admin-listings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteListing = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketplace_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Listing deleted"); queryClient.invalidateQueries({ queryKey: ["admin-listings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const hide = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from("posts").update({ hidden: true }).eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Post hidden"); queryClient.invalidateQueries({ queryKey: ["admin-reports"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reports").update({ status: "resolved" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reports"] }),
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reports").update({ status: "dismissed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reports"] }),
  });

  const setRedemption = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: "paid" | "rejected" | "approved"; note?: string }) => {
      const patch: { status: typeof status; admin_notes?: string } = { status };
      if (note) patch.admin_notes = note;
      const { error } = await supabase.from("redemptions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.status === "paid" ? "Marked paid ✓" : vars.status === "rejected" ? "Rejected & refunded" : "Approved");
      queryClient.invalidateQueries({ queryKey: ["admin-redemptions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Ambassadors
  const fetchApps = useServerFn(adminListApplications);
  const fetchAmbs = useServerFn(adminListAmbassadors);
  const reviewApp = useServerFn(adminReviewApplication);
  const setTier = useServerFn(adminSetAmbassadorTier);
  const setStatus = useServerFn(adminSetAmbassadorStatus);
  const publish = useServerFn(adminPublishAnnouncement);
  const createTask = useServerFn(adminCreateTask);

  const applications = useQuery({
    queryKey: ["admin-ambassador-apps"],
    enabled: tab === "ambassadors",
    queryFn: () => fetchApps(),
  });
  const ambassadors = useQuery({
    queryKey: ["admin-ambassadors"],
    enabled: tab === "ambassadors",
    queryFn: () => fetchAmbs(),
  });

  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskReward, setTaskReward] = useState(200);

  const doReview = useMutation({
    mutationFn: async (v: { applicationId: string; decision: "approve" | "reject" }) => reviewApp({ data: v }),
    onSuccess: () => {
      toast.success("Application reviewed.");
      queryClient.invalidateQueries({ queryKey: ["admin-ambassador-apps"] });
      queryClient.invalidateQueries({ queryKey: ["admin-ambassadors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const doTier = useMutation({
    mutationFn: async (v: { userId: string; tier: "ambassador" | "senior" | "regional_lead" }) => setTier({ data: v }),
    onSuccess: () => { toast.success("Tier updated."); queryClient.invalidateQueries({ queryKey: ["admin-ambassadors"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const doStatus = useMutation({
    mutationFn: async (v: { userId: string; status: "active" | "suspended"; reason?: string }) => setStatus({ data: v }),
    onSuccess: () => { toast.success("Status updated."); queryClient.invalidateQueries({ queryKey: ["admin-ambassadors"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const doPublish = useMutation({
    mutationFn: async () => publish({ data: { title: annTitle, body: annBody } }),
    onSuccess: () => { toast.success("Announcement published."); setAnnTitle(""); setAnnBody(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  const doCreateTask = useMutation({
    mutationFn: async () => createTask({ data: { title: taskTitle, description: taskDesc, reward_points: taskReward } }),
    onSuccess: () => { toast.success("Task created."); setTaskTitle(""); setTaskDesc(""); setTaskReward(200); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div className="mb-2 flex items-center justify-between">
        <h1 className="font-display text-3xl">Admin</h1>
        <OverseerLink />
      </div>
      <div className="mb-6 flex flex-wrap gap-2 border-b border-border/60">
        {([
          ["reports", `Moderation${reports.data ? ` · ${reports.data.length}` : ""}`],
          ["events", `Events${allEvents.data ? ` · ${allEvents.data.length}` : ""}`],
          ["listings", `Listings${allListings.data ? ` · ${allListings.data.length}` : ""}`],
          ["redemptions", `Cash-outs${redemptions.data ? ` · ${redemptions.data.length}` : ""}`],
          ["ambassadors", `Ambassadors${applications.data ? ` · ${applications.data.length}` : ""}`],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>


      {tab === "reports" && (
        <div className="space-y-3">
          {reports.data?.map((r) => {
            const reporter = Array.isArray(r.reporter) ? r.reporter[0] : r.reporter;
            return (
              <div key={r.id} className="rounded-2xl border border-border/60 bg-card p-4">
                <div className="text-xs text-muted-foreground">
                  {r.target_kind} · reported by {reporter?.display_name ?? "someone"} · {timeAgo(r.created_at)}
                </div>
                <p className="mt-1 text-sm">Reason: <span className="font-medium">{r.reason}</span></p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.target_kind === "post" && (
                    <>
                      <Link to="/post/$id" params={{ id: r.target_id }} className="rounded-md bg-secondary px-3 py-1.5 text-xs hover:bg-secondary/70">View post</Link>
                      <Button size="sm" variant="destructive" onClick={() => hide.mutate(r.target_id)}>Hide post</Button>
                    </>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => resolve.mutate(r.id)}>Mark resolved</Button>
                  <Button size="sm" variant="outline" onClick={() => dismiss.mutate(r.id)}>Dismiss</Button>
                </div>
              </div>
            );
          })}
          {reports.data && reports.data.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">No open reports. Quiet campus today.</div>
          )}
        </div>
      )}

      {tab === "redemptions" && (
        <div className="space-y-3">
          {redemptions.data?.map((r) => {
            const u = Array.isArray(r.user) ? r.user[0] : r.user;
            const payload = (r.payload ?? {}) as Record<string, string>;
            return (
              <div key={r.id} className="rounded-2xl border border-border/60 bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{r.kind} · {timeAgo(r.created_at)}</div>
                    <div className="mt-1 font-display text-xl">₦{r.amount_naira.toLocaleString()} <span className="text-xs text-muted-foreground">({formatPoints(r.amount_points)})</span></div>
                    <Link to="/u/$id" params={{ id: u?.id ?? "" }} className="mt-0.5 inline-block text-sm text-primary hover:underline">{u?.display_name ?? "Unknown student"}</Link>
                  </div>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{r.status}</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  {Object.entries(payload).map(([k, v]) => (
                    <div key={k}>
                      <dt className="uppercase tracking-wide">{k.replace(/_/g, " ")}</dt>
                      <dd className="text-foreground">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setRedemption.mutate({ id: r.id, status: "paid" })}>Mark paid</Button>
                  <Button size="sm" variant="secondary" onClick={() => setRedemption.mutate({ id: r.id, status: "approved" })}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    const note = window.prompt("Reason for rejection? (refund will be issued)") ?? undefined;
                    if (note !== undefined) setRedemption.mutate({ id: r.id, status: "rejected", note });
                  }}>Reject & refund</Button>
                </div>
              </div>
            );
          })}
          {redemptions.data && redemptions.data.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">No pending cash-outs. 🎉</div>
          )}
        </div>
      )}

      {tab === "events" && (
        <div className="space-y-3">
          {allEvents.data?.map((e) => {
            const host = Array.isArray(e.host) ? e.host[0] : e.host;
            const school = Array.isArray(e.school) ? e.school[0] : e.school;
            return (
              <div key={e.id} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-3">
                {e.cover_url && <img src={e.cover_url} alt="" className="h-16 w-24 flex-shrink-0 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{e.title}</p>
                    {e.status === "hidden" && <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] uppercase text-destructive">Hidden</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.starts_at).toLocaleString()} · {school?.short_name ?? "—"} · {host?.display_name ?? "?"} · {e.rsvp_count} RSVPs
                  </p>
                </div>
                <div className="flex flex-shrink-0 flex-col gap-1">
                  {e.status === "hidden" ? (
                    <Button size="sm" variant="secondary" onClick={() => setEventStatus.mutate({ id: e.id, status: "active" })}>Restore</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setEventStatus.mutate({ id: e.id, status: "hidden" })}>Hide</Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => { if (confirm("Delete this event permanently?")) deleteEvent.mutate(e.id); }}>Delete</Button>
                </div>
              </div>
            );
          })}
          {allEvents.data && allEvents.data.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">No events yet.</div>
          )}
        </div>
      )}

      {tab === "listings" && (
        <div className="space-y-3">
          {allListings.data?.map((it) => {
            const seller = Array.isArray(it.seller) ? it.seller[0] : it.seller;
            const school = Array.isArray(it.school) ? it.school[0] : it.school;
            return (
              <div key={it.id} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-3">
                {it.image_url && <img src={it.image_url} alt="" className="h-16 w-16 flex-shrink-0 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{it.title}</p>
                    {it.status !== "active" && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase">{it.status}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ₦{it.price_naira.toLocaleString()} · {it.category} · {school?.short_name ?? "—"} · {seller?.display_name ?? "?"}
                  </p>
                </div>
                <div className="flex flex-shrink-0 flex-col gap-1">
                  {it.status === "hidden" ? (
                    <Button size="sm" variant="secondary" onClick={() => setListingStatus.mutate({ id: it.id, status: "active" })}>Restore</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setListingStatus.mutate({ id: it.id, status: "hidden" })}>Hide</Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => { if (confirm("Delete this listing permanently?")) deleteListing.mutate(it.id); }}>Delete</Button>
                </div>
              </div>
            );
          })}
          {allListings.data && allListings.data.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">No listings yet.</div>
          )}
        </div>
      )}

      {tab === "ambassadors" && (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 font-display text-xl">Pending applications</h2>
            <div className="space-y-3">
              {applications.data?.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">No pending applications.</div>
              )}
              {applications.data?.map((a) => {
                const applicant = Array.isArray(a.applicant) ? a.applicant[0] : a.applicant;
                const school = Array.isArray(a.school) ? a.school[0] : a.school;
                return (
                  <div key={a.id} className="rounded-2xl border border-border/60 bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link to="/u/$id" params={{ id: applicant?.id ?? "" }} className="font-medium text-primary hover:underline">
                          {applicant?.display_name ?? "Unknown"}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {a.scope_type}{school ? ` · ${school.short_name}` : ""} · {timeAgo(a.created_at)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{a.motivation}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => doReview.mutate({ applicationId: a.id, decision: "approve" })}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => doReview.mutate({ applicationId: a.id, decision: "reject" })}>Reject</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-2 font-display text-xl">Active ambassadors</h2>
            <div className="space-y-2">
              {ambassadors.data?.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">No ambassadors yet.</div>
              )}
              {ambassadors.data?.map((a) => {
                const u = Array.isArray(a.user) ? a.user[0] : a.user;
                const school = Array.isArray(a.school) ? a.school[0] : a.school;
                return (
                  <div key={a.user_id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
                    <div className="min-w-0 flex-1">
                      <Link to="/u/$id" params={{ id: u?.id ?? "" }} className="font-medium hover:underline">
                        {u?.display_name ?? "Unknown"}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {a.tier} · {a.scope_type}{school ? ` · ${school.short_name}` : ""} · {a.status}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {a.tier !== "senior" && (
                        <Button size="sm" variant="secondary" onClick={() => doTier.mutate({ userId: a.user_id, tier: "senior" })}>Promote → Senior</Button>
                      )}
                      {a.tier !== "regional_lead" && (
                        <Button size="sm" variant="secondary" onClick={() => doTier.mutate({ userId: a.user_id, tier: "regional_lead" })}>→ Regional Lead</Button>
                      )}
                      {a.status === "active" ? (
                        <Button size="sm" variant="outline" onClick={() => {
                          const reason = window.prompt("Reason for suspension?") ?? undefined;
                          if (reason !== undefined) doStatus.mutate({ userId: a.user_id, status: "suspended", reason });
                        }}>Suspend</Button>
                      ) : (
                        <Button size="sm" onClick={() => doStatus.mutate({ userId: a.user_id, status: "active" })}>Reinstate</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card p-4">
            <h2 className="mb-2 font-display text-xl">Publish announcement</h2>
            <div className="space-y-2">
              <Input placeholder="Title" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} />
              <Textarea placeholder="Message to all ambassadors…" value={annBody} onChange={(e) => setAnnBody(e.target.value)} rows={4} />
              <Button onClick={() => doPublish.mutate()} disabled={doPublish.isPending || annTitle.length < 2 || annBody.length < 2}>Publish</Button>
            </div>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card p-4">
            <h2 className="mb-2 font-display text-xl">Create ambassador task</h2>
            <div className="space-y-2">
              <Input placeholder="Task title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
              <Textarea placeholder="What should ambassadors do?" value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} rows={4} />
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Reward (Campoints)</label>
                <Input type="number" min={0} value={taskReward} onChange={(e) => setTaskReward(parseInt(e.target.value || "0", 10))} className="w-32" />
              </div>
              <Button onClick={() => doCreateTask.mutate()} disabled={doCreateTask.isPending || taskTitle.length < 2 || taskDesc.length < 2}>Create task</Button>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function OverseerLink() {
  const q = useQuery({
    queryKey: ["is-owner"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "owner").maybeSingle();
      return !!data;
    },
    staleTime: 60_000,
  });
  if (!q.data) return null;
  return (
    <Link to="/overseer" className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700">
      Overseer →
    </Link>
  );
}
