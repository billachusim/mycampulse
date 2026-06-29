import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuthUser, initials } from "@/lib/profile";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/connections")({
  component: ConnectionsPage,
});

function ConnectionsPage() {
  const { user } = useAuthUser();
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ["connections", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("connections")
        .select("id, status, requester_id, addressee_id, requester:profiles!connections_requester_id_profiles_fkey(id, display_name, avatar_url), addressee:profiles!connections_addressee_id_profiles_fkey(id, display_name, avatar_url)")
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const respond = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "declined" }) => {
      const { error } = await supabase.from("connections").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["connections"] }); toast.success("Updated"); },
  });

  const incoming = (list.data ?? []).filter(c => c.status === "pending" && c.addressee_id === user?.id);
  const outgoing = (list.data ?? []).filter(c => c.status === "pending" && c.requester_id === user?.id);
  const accepted = (list.data ?? []).filter(c => c.status === "accepted");

  return (
    <AppShell>
      <h1 className="mb-6 font-display text-3xl">People</h1>
      <Section title="Requests" empty="No one's asked to connect yet.">
        {incoming.map(c => {
          const p = Array.isArray(c.requester) ? c.requester[0] : c.requester;
          return (
            <Row key={c.id} p={p}>
              <Button size="sm" onClick={() => respond.mutate({ id: c.id, status: "accepted" })} className="brand-gradient text-primary-foreground">Accept</Button>
              <Button size="sm" variant="secondary" onClick={() => respond.mutate({ id: c.id, status: "declined" })}>Decline</Button>
            </Row>
          );
        })}
      </Section>
      <Section title="Sent" empty="No outgoing requests.">
        {outgoing.map(c => {
          const p = Array.isArray(c.addressee) ? c.addressee[0] : c.addressee;
          return <Row key={c.id} p={p}><span className="text-xs text-muted-foreground">Pending</span></Row>;
        })}
      </Section>
      <Section title="Connections" empty="No connections yet — find people via Discover or your campus.">
        {accepted.map(c => {
          const other = c.requester_id === user?.id ? c.addressee : c.requester;
          const p = Array.isArray(other) ? other[0] : other;
          return <Row key={c.id} p={p} />;
        })}
      </Section>
    </AppShell>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs uppercase tracking-widest text-primary">{title}</h2>
      {hasChildren ? <div className="space-y-2">{children}</div> : <p className="text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}

function Row({ p, children }: { p: { id: string; display_name: string | null; avatar_url: string | null } | null | undefined; children?: React.ReactNode }) {
  if (!p) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
      <Link to="/u/$id" params={{ id: p.id }}>
        <Avatar className="h-10 w-10">
          <AvatarImage src={p.avatar_url ?? undefined} />
          <AvatarFallback>{initials(p.display_name)}</AvatarFallback>
        </Avatar>
      </Link>
      <Link to="/u/$id" params={{ id: p.id }} className="flex-1 text-sm font-medium hover:underline">{p.display_name ?? "Anonymous"}</Link>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}
