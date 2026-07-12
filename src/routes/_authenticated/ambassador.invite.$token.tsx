import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Award, Clock } from "lucide-react";
import { acceptInvitation, getInvitationByToken } from "@/lib/ambassador.functions";

export const Route = createFileRoute("/_authenticated/ambassador/invite/$token")({
  component: InviteAcceptPage,
});

function InviteAcceptPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const fetchInv = useServerFn(getInvitationByToken);
  const accept = useServerFn(acceptInvitation);
  const inv = useQuery({ queryKey: ["invitation", token], queryFn: () => fetchInv({ data: { token } }) });

  const acceptM = useMutation({
    mutationFn: async () => accept({ data: { token } }),
    onSuccess: () => {
      toast.success("Welcome aboard — you're now an ambassador.");
      navigate({ to: "/ambassador" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (inv.isLoading) {
    return <AppShell><div className="text-sm text-muted-foreground">Loading invitation…</div></AppShell>;
  }
  const data = inv.data;
  if (!data || !data.ok) {
    const reason = data && !data.ok ? data.reason : "not_found";
    return (
      <AppShell>
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <h1 className="font-display text-2xl">Invitation unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {reason === "expired" ? "This invitation has expired." :
             reason === "accepted" ? "This invitation has already been accepted." :
             reason === "revoked" ? "This invitation was revoked." :
             "We couldn't find that invitation."}
          </p>
        </div>
      </AppShell>
    );
  }

  const i = data.invitation;
  const schoolName = (i.school as { name?: string } | null)?.name ?? "your campus";
  const label = i.scope_type === "faculty" ? "Faculty" : i.scope_type === "department" ? "Department" : "Hostel";

  return (
    <AppShell>
      <div className="space-y-4">
        <section className="rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
            <Award className="h-4 w-4" /> Ambassador invitation
          </div>
          <h1 className="mt-1 font-display text-3xl">You've been invited</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your campus ambassador at {schoolName} has invited you to become a <strong>{label} Ambassador</strong>{i.region ? ` for ${i.region}` : ""}. Accept to unlock your dashboard, campaign codes, and bonus Campoints.
          </p>
          {i.message && <blockquote className="mt-3 rounded-md border-l-2 border-primary bg-secondary/40 p-3 text-sm">{i.message}</blockquote>}
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Expires {new Date(i.expires_at).toLocaleDateString()}
          </div>
          <Button className="mt-4 brand-gradient text-primary-foreground" onClick={() => acceptM.mutate()} disabled={acceptM.isPending}>
            {acceptM.isPending ? "Accepting…" : "Accept invitation"}
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
