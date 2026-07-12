import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { applyForAmbassador, getMyAmbassadorStatus } from "@/lib/ambassador.functions";
import { Award, Check, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ambassador/apply")({
  component: ApplyPage,
});

function ApplyPage() {
  const navigate = useNavigate();
  const fetchStatus = useServerFn(getMyAmbassadorStatus);
  const apply = useServerFn(applyForAmbassador);
  const status = useQuery({ queryKey: ["ambassador-status"], queryFn: () => fetchStatus() });

  const [motivation, setMotivation] = useState("");
  const [instagram, setInstagram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const submit = useMutation({
    mutationFn: async () => apply({ data: {
      motivation,
      socials: { instagram, twitter, whatsapp },
      scope_type: "school",
    }}),
    onSuccess: (r) => {
      if (!r.ok && r.reason === "already_ambassador") {
        toast.success("You're already an ambassador — welcome to the dashboard.");
        navigate({ to: "/ambassador" });
        return;
      }
      if (!r.ok && r.reason === "pending_exists") {
        toast("You already have a pending application.");
        status.refetch();
        return;
      }
      if (!r.ok && r.reason === "scope_required") {
        toast.error("Set your school in Settings first.");
        return;
      }
      toast.success("Application received — we'll review it shortly.");
      status.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const s = status.data;
  const isActive = s?.ambassador?.status === "active";
  const pending = s?.application?.status === "pending";

  if (isActive) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-6">
          <div className="flex items-center gap-2 text-primary"><Check className="h-5 w-5" /> You're a Campus Ambassador</div>
          <p className="mt-2 text-sm">Head to your dashboard to manage campaigns and tasks.</p>
          <Link to="/ambassador" className="mt-3 inline-block underline">Open dashboard →</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
            <Award className="h-4 w-4" /> Campus Ambassador Program
          </div>
          <h1 className="mt-1 font-display text-3xl">Represent your campus</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ambassadors run their campus on Campulse — hosting activations, growing the community, and unlocking bonus Campoints, marketing assets, and leadership tiers.
          </p>
        </section>

        {pending && (
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/40 p-4 text-sm">
            <Clock className="h-4 w-4 text-primary" />
            Your application is under review — we usually get back within 3 days.
          </div>
        )}

        {!pending && (
          <form
            onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}
            className="space-y-4 rounded-2xl border border-border/60 bg-card p-6"
          >
            <div>
              <Label>Why do you want to be your campus ambassador?</Label>
              <Textarea
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                placeholder="Tell us about your involvement on campus, your reach, and what you'd do first."
                minLength={30}
                maxLength={2000}
                rows={5}
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">{motivation.length}/2000</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Instagram</Label>
                <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@handle" />
              </div>
              <div>
                <Label>X / Twitter</Label>
                <Input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@handle" />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+234…" />
              </div>
            </div>
            <Button type="submit" disabled={submit.isPending || motivation.trim().length < 30} className="brand-gradient text-primary-foreground">
              {submit.isPending ? "Submitting…" : "Submit application"}
            </Button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
