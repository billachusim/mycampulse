import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { timeAgo } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
    if (!role) throw redirect({ to: "/home" });
  },
  component: AdminPage,
});

function AdminPage() {
  const queryClient = useQueryClient();

  const reports = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, target_kind, target_id, reason, status, created_at, reporter:profiles!reports_reporter_id_fkey(display_name)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
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

  return (
    <AppShell>
      <h1 className="mb-6 font-display text-3xl">Moderation</h1>
      <p className="mb-4 text-sm text-muted-foreground">Open reports across every campus.</p>
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
    </AppShell>
  );
}
