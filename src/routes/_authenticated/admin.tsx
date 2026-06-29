import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { timeAgo } from "@/lib/profile";
import { formatPoints } from "@/lib/campoints";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
    if (!role) throw redirect({ to: "/home" });
  },
  component: AdminPage,
});

type Tab = "reports" | "redemptions" | "events" | "listings";

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

  return (
    <AppShell>
      <h1 className="mb-2 font-display text-3xl">Admin</h1>
      <div className="mb-6 flex gap-2 border-b border-border/60">
        {([
          ["reports", `Moderation${reports.data ? ` · ${reports.data.length}` : ""}`],
          ["redemptions", `Cash-outs${redemptions.data ? ` · ${redemptions.data.length}` : ""}`],
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
    </AppShell>
  );
}
