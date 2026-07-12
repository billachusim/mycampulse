import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  applyForAmbassador,
  getMyAmbassadorStatus,
  listSchoolScopes,
} from "@/lib/ambassador.functions";
import { supabase } from "@/integrations/supabase/client";
import { Award, Check, Clock } from "lucide-react";

const searchSchema = z.object({
  scope: z.enum(["school", "faculty", "department", "hostel"]).optional(),
});

export const Route = createFileRoute("/_authenticated/ambassador/apply")({
  component: ApplyPage,
  validateSearch: (s) => searchSchema.parse(s),
});

type ScopeType = "school" | "faculty" | "department" | "hostel";

function ApplyPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const fetchStatus = useServerFn(getMyAmbassadorStatus);
  const apply = useServerFn(applyForAmbassador);
  const fetchScopes = useServerFn(listSchoolScopes);
  const status = useQuery({ queryKey: ["ambassador-status"], queryFn: () => fetchStatus() });

  const [scopeType, setScopeType] = useState<ScopeType>(search.scope ?? "school");
  const [motivation, setMotivation] = useState("");
  const [instagram, setInstagram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [scopeId, setScopeId] = useState<string>("");
  const [region, setRegion] = useState("");

  // If applying for a sub-scope, load faculties/departments for the user's school
  const [faculties, setFaculties] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string; faculty_id: string }[]>([]);
  useMemo(() => {
    // Load once; user's school scopes come from schools table via a lightweight query
    (async () => {
      if (scopeType !== "faculty" && scopeType !== "department") return;
      // For applicants we don't have a "campus ambassador" role, so we hit tables directly with RLS
      const { data: profile } = await supabase.from("profiles").select("primary_school_id").maybeSingle();
      const schoolId = profile?.primary_school_id;
      if (!schoolId) return;
      const { data: facs } = await supabase.from("faculties").select("id, name").eq("school_id", schoolId).order("name");
      setFaculties(facs ?? []);
      const facIds = (facs ?? []).map((f) => f.id);
      if (facIds.length) {
        const { data: deps } = await supabase.from("departments").select("id, name, faculty_id").in("faculty_id", facIds).order("name");
        setDepartments(deps ?? []);
      }
    })();
    void fetchScopes; // keep import used
  }, [scopeType]);

  const submit = useMutation({
    mutationFn: async () => apply({ data: {
      motivation,
      socials: { instagram, twitter, whatsapp },
      scope_type: scopeType,
      scope_id: scopeType === "hostel" || scopeType === "school" ? null : (scopeId || null),
      region: scopeType === "hostel" ? (region || null) : null,
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
        toast.error(scopeType === "school" ? "Set your school in Settings first." : "Pick a specific scope.");
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
          <div className="flex items-center gap-2 text-primary"><Check className="h-5 w-5" /> You're already an ambassador</div>
          <p className="mt-2 text-sm">Head to your dashboard to manage campaigns and tasks.</p>
          <Link to="/ambassador" className="mt-3 inline-block underline">Open dashboard →</Link>
        </div>
      </AppShell>
    );
  }

  const scopeOptions: { key: ScopeType; label: string; desc: string }[] = [
    { key: "school", label: "Campus", desc: "Lead your whole school (admin-approved)." },
    { key: "faculty", label: "Faculty", desc: "Represent a specific faculty. Approved by your campus ambassador." },
    { key: "department", label: "Department", desc: "Represent a specific department. Approved by your campus ambassador." },
    { key: "hostel", label: "Hostel", desc: "Represent a specific hostel. Approved by your campus ambassador." },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
            <Award className="h-4 w-4" /> Campus Ambassador Program
          </div>
          <h1 className="mt-1 font-display text-3xl">Represent your community</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ambassadors run their campus — or their faculty, department, or hostel — on Campulse. Bonus Campoints, marketing assets, and leadership tiers included.
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
              <Label>What do you want to represent?</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {scopeOptions.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setScopeType(o.key)}
                    className={`rounded-xl border p-3 text-left text-sm transition ${
                      scopeType === o.key ? "border-primary bg-primary/10" : "border-border/60 bg-background hover:bg-secondary/50"
                    }`}
                  >
                    <p className="font-medium">{o.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{o.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {(scopeType === "faculty" || scopeType === "department") && (
              <div>
                <Label>{scopeType === "faculty" ? "Faculty" : "Department"}</Label>
                <select
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={scopeId}
                  onChange={(e) => setScopeId(e.target.value)}
                  required
                >
                  <option value="">Choose…</option>
                  {scopeType === "faculty"
                    ? faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)
                    : departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}

            {scopeType === "hostel" && (
              <div>
                <Label>Hostel name</Label>
                <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Queen Amina Hall" required />
              </div>
            )}

            <div>
              <Label>Why should you represent this scope?</Label>
              <Textarea
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                placeholder="Tell us about your involvement, your reach, and what you'd do first."
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
