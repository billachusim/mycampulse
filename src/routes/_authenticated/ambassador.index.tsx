import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Award, Copy, Download, Megaphone, Target, TrendingUp, Users, Plus, Send, Mail, ShieldCheck, ShieldX, ArrowUp, Check, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  createAmbassadorCampaign,
  getMyAmbassadorDashboard,
  getMyAmbassadorStatus,
  submitAmbassadorTask,
  listSubApplications,
  reviewSubApplication,
  listSubAmbassadors,
  setSubAmbassadorStatus,
  setSubAmbassadorTier,
  inviteSubAmbassador,
  listMyInvitations,
  revokeInvitation,
  listSchoolScopes,
  listSubTaskCompletions,
  reviewSubTaskCompletion,
} from "@/lib/ambassador.functions";
import { formatPoints } from "@/lib/campoints";
import { timeAgo } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/ambassador/")({
  component: AmbassadorDashboard,
});

function AmbassadorDashboard() {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getMyAmbassadorStatus);
  const fetchDashboard = useServerFn(getMyAmbassadorDashboard);
  const createCampaign = useServerFn(createAmbassadorCampaign);
  const submitTask = useServerFn(submitAmbassadorTask);


  const status = useQuery({ queryKey: ["ambassador-status"], queryFn: () => fetchStatus() });
  const dash = useQuery({
    queryKey: ["ambassador-dashboard"],
    queryFn: () => fetchDashboard(),
    enabled: status.data?.ambassador?.status === "active",
  });

  const [campaignName, setCampaignName] = useState("");
  const [campaignCode, setCampaignCode] = useState("");
  const [taskEvidence, setTaskEvidence] = useState<Record<string, string>>({});

  const createCampaignM = useMutation({
    mutationFn: async () => createCampaign({ data: { name: campaignName, code: campaignCode } }),
    onSuccess: () => {
      toast.success("Campaign created — share your link.");
      setCampaignName(""); setCampaignCode("");
      qc.invalidateQueries({ queryKey: ["ambassador-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitTaskM = useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) =>
      submitTask({ data: { taskId, evidenceUrl: taskEvidence[taskId] || undefined } }),
    onSuccess: (r) => {
      if (!r.ok && r.reason === "already_submitted") toast("Already submitted — awaiting review.");
      else toast.success("Submitted for review.");
      qc.invalidateQueries({ queryKey: ["ambassador-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Not an ambassador → prompt to apply
  if (status.data && status.data.ambassador?.status !== "active") {
    const pending = status.data.application?.status === "pending";
    return (
      <AppShell>
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
            <Award className="h-4 w-4" /> Campus Ambassador Program
          </div>
          <h1 className="mt-1 font-display text-3xl">Lead your campus on Campulse</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {pending
              ? "Your application is under review. You'll see your dashboard as soon as we approve it."
              : "Apply to become your campus's primary ambassador. Bonus Campoints, marketing kit, and leadership tiers included."}
          </p>
          <Link to="/ambassador/apply" className="mt-4 inline-block rounded-md brand-gradient px-4 py-2 text-sm text-primary-foreground">
            {pending ? "View application" : "Apply now"}
          </Link>
        </div>
      </AppShell>
    );
  }

  const d = dash.data && dash.data.active ? dash.data : null;
  const amb = d?.ambassador;

  const copyLink = async (code: string) => {
    const link = `${window.location.origin}/auth?ref=${code}`;
    await navigator.clipboard.writeText(link);
    toast.success("Invite link copied.");
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6">
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full brand-gradient opacity-30 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary"><Award className="h-4 w-4" /> Ambassador dashboard</div>
            <h1 className="mt-1 font-display text-4xl">
              {amb?.tier === "regional_lead" ? "Regional Lead" : amb?.tier === "senior" ? "Senior Ambassador" : "Campus Ambassador"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground capitalize">
              Scope: {amb?.scope_type}{amb?.region ? ` · ${amb.region}` : ""}
            </p>
          </div>
        </section>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric icon={<Users className="h-4 w-4" />} label="Verified referrals" value={d?.metrics.verifiedReferrals ?? 0} />
          <Metric icon={<TrendingUp className="h-4 w-4" />} label="Active users (30d)" value={d?.metrics.activeUsers ?? 0} />
          <Metric icon={<Target className="h-4 w-4" />} label="Campus rank" value={d?.metrics.campusRank ? `#${d.metrics.campusRank}` : "—"} />
          <Metric icon={<Award className="h-4 w-4" />} label="National rank" value={d?.metrics.nationalRank ? `#${d.metrics.nationalRank}` : "—"} />
        </div>

        {(() => {
          const isCampusAmbassador = amb?.scope_type === "school" && amb?.tier === "ambassador";
          return (
            <Tabs defaultValue="growth">
              <TabsList className="flex flex-wrap">
                <TabsTrigger value="growth">Growth</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="news">News & assets</TabsTrigger>
                {isCampusAmbassador && <TabsTrigger value="team">Team</TabsTrigger>}
              </TabsList>

              <TabsContent value="growth" className="space-y-6">
                {/* Campaigns */}
                <section className="rounded-2xl border border-border/60 bg-card p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-2xl">Campaign codes</h2>
                    <span className="text-xs text-muted-foreground">{d?.campaigns.length ?? 0} active</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Share your codes on flyers, in classes, and across your socials. Every sign-up counts toward your ranking.</p>

                  <form
                    onSubmit={(e) => { e.preventDefault(); createCampaignM.mutate(); }}
                    className="mt-4 grid gap-2 sm:grid-cols-[1fr_140px_auto]"
                  >
                    <Input placeholder="Campaign name (e.g. Freshers Week)" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} required />
                    <Input placeholder="CODE" value={campaignCode} onChange={(e) => setCampaignCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={16} className="font-mono tracking-widest" required />
                    <Button type="submit" disabled={createCampaignM.isPending}><Plus className="mr-1.5 h-4 w-4" /> Create</Button>
                  </form>

                  <div className="mt-4 space-y-2">
                    {d?.campaigns.length === 0 && <p className="text-sm text-muted-foreground">No campaigns yet — create your first one above.</p>}
                    {d?.campaigns.map((c) => (
                      <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
                        <code className="rounded bg-secondary px-2 py-1 font-mono tracking-widest">{c.code}</code>
                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                        <Button size="sm" variant="secondary" onClick={() => copyLink(c.code)}><Copy className="mr-1 h-3.5 w-3.5" /> Copy link</Button>
                      </div>
                    ))}
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="tasks" className="space-y-6">
                <section className="rounded-2xl border border-border/60 bg-card p-5">
                  <h2 className="font-display text-2xl">Ambassador tasks</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Complete tasks to earn extra Campoints and unlock promotions.</p>
                  <div className="mt-3 space-y-3">
                    {d?.tasks.length === 0 && <p className="text-sm text-muted-foreground">No open tasks right now — check back soon.</p>}
                    {d?.tasks.map((t) => {
                      const completion = d.completions.find(c => c.task_id === t.id);
                      return (
                        <div key={t.id} className="rounded-xl border border-border/60 bg-background p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium">{t.title}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                            </div>
                            <span className="whitespace-nowrap rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">+{formatPoints(t.reward_points)}</span>
                          </div>
                          {completion ? (
                            <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Status: {completion.status}</p>
                          ) : (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Input
                                placeholder="Evidence URL (photo, tweet, receipt)"
                                value={taskEvidence[t.id] ?? ""}
                                onChange={(e) => setTaskEvidence(v => ({ ...v, [t.id]: e.target.value }))}
                                className="flex-1 min-w-[200px]"
                              />
                              <Button size="sm" onClick={() => submitTaskM.mutate({ taskId: t.id })} disabled={submitTaskM.isPending}>
                                <Send className="mr-1 h-3.5 w-3.5" /> Submit
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="news" className="space-y-6">
                <section className="rounded-2xl border border-border/60 bg-card p-5">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary"><Megaphone className="h-4 w-4" /> Announcements</div>
                  <div className="mt-3 space-y-3">
                    {d?.announcements.length === 0 && <p className="text-sm text-muted-foreground">No announcements yet.</p>}
                    {d?.announcements.map((a) => (
                      <article key={a.id} className="rounded-xl border border-border/60 bg-background p-4">
                        <h3 className="font-medium">{a.title}</h3>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{timeAgo(a.published_at)}</p>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-border/60 bg-card p-5">
                  <h2 className="font-display text-2xl">Marketing assets</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Ready-to-share visuals, copy, and PDFs for your campus.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {d?.assets.length === 0 && <p className="text-sm text-muted-foreground">Assets will appear here once the team uploads them.</p>}
                    {d?.assets.map((a) => (
                      <a
                        key={a.id}
                        href={a.external_url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background p-3 text-sm hover:bg-secondary/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{a.title}</p>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{a.kind}</p>
                        </div>
                        <Download className="h-4 w-4 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                </section>
              </TabsContent>

              {isCampusAmbassador && (
                <TabsContent value="team" className="space-y-6">
                  <TeamPanel />
                </TabsContent>
              )}
            </Tabs>
          );
        })()}
      </div>
    </AppShell>
  );
}


function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">{icon} {label}</div>
      <div className="mt-1 font-display text-2xl">{value}</div>
    </div>
  );
}

function TeamPanel() {
  const qc = useQueryClient();
  const fetchApps = useServerFn(listSubApplications);
  const reviewApp = useServerFn(reviewSubApplication);
  const fetchSubs = useServerFn(listSubAmbassadors);
  const setStatus = useServerFn(setSubAmbassadorStatus);
  const setTier = useServerFn(setSubAmbassadorTier);
  const invite = useServerFn(inviteSubAmbassador);
  const fetchInvites = useServerFn(listMyInvitations);
  const revoke = useServerFn(revokeInvitation);
  const fetchScopes = useServerFn(listSchoolScopes);
  const fetchCompletions = useServerFn(listSubTaskCompletions);
  const reviewCompletion = useServerFn(reviewSubTaskCompletion);

  const apps = useQuery({ queryKey: ["sub-apps"], queryFn: () => fetchApps() });
  const subs = useQuery({ queryKey: ["sub-ambassadors"], queryFn: () => fetchSubs() });
  const invites = useQuery({ queryKey: ["my-invitations"], queryFn: () => fetchInvites() });
  const scopes = useQuery({ queryKey: ["school-scopes"], queryFn: () => fetchScopes() });
  const completions = useQuery({ queryKey: ["sub-completions"], queryFn: () => fetchCompletions() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sub-apps"] });
    qc.invalidateQueries({ queryKey: ["sub-ambassadors"] });
    qc.invalidateQueries({ queryKey: ["my-invitations"] });
    qc.invalidateQueries({ queryKey: ["sub-completions"] });
  };

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteScope, setInviteScope] = useState<"faculty" | "department" | "hostel">("faculty");
  const [inviteScopeId, setInviteScopeId] = useState<string>("");
  const [inviteRegion, setInviteRegion] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");

  const inviteM = useMutation({
    mutationFn: async () => invite({ data: {
      email: inviteEmail,
      scope_type: inviteScope,
      scope_id: inviteScope === "hostel" ? null : (inviteScopeId || null),
      region: inviteScope === "hostel" ? (inviteRegion || null) : null,
      message: inviteMsg || undefined,
    }}),
    onSuccess: () => {
      toast.success("Invitation sent.");
      setInviteEmail(""); setInviteScopeId(""); setInviteRegion(""); setInviteMsg("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewAppM = useMutation({
    mutationFn: async (v: { applicationId: string; decision: "approve" | "reject" }) => reviewApp({ data: v }),
    onSuccess: () => { toast.success("Updated."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const setStatusM = useMutation({
    mutationFn: async (v: { userId: string; status: "active" | "suspended" }) => setStatus({ data: v }),
    onSuccess: () => { toast.success("Updated."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const setTierM = useMutation({
    mutationFn: async (v: { userId: string; tier: "ambassador" | "senior" }) => setTier({ data: v }),
    onSuccess: () => { toast.success("Promoted."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const revokeM = useMutation({
    mutationFn: async (id: string) => revoke({ data: { id } }),
    onSuccess: () => { toast.success("Invitation revoked."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const reviewCompletionM = useMutation({
    mutationFn: async (v: { completionId: string; decision: "approve" | "reject" }) => reviewCompletion({ data: v }),
    onSuccess: () => { toast.success("Reviewed."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/ambassador/invite/${token}`;
    await navigator.clipboard.writeText(link);
    toast.success("Invite link copied.");
  };

  const facultyName = (id: string | null) => scopes.data?.faculties.find(f => f.id === id)?.name ?? "—";
  const departmentName = (id: string | null) => scopes.data?.departments.find(d => d.id === id)?.name ?? "—";
  const scopeLabel = (row: { scope_type: string; scope_id: string | null; region: string | null }) => {
    if (row.scope_type === "faculty") return `Faculty · ${facultyName(row.scope_id)}`;
    if (row.scope_type === "department") return `Dept · ${departmentName(row.scope_id)}`;
    if (row.scope_type === "hostel") return `Hostel · ${row.region ?? "—"}`;
    return row.scope_type;
  };

  return (
    <div className="space-y-6">
      {/* Invite */}
      <section className="rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary"><Mail className="h-4 w-4" /> Invite a sub-ambassador</div>
        <p className="mt-1 text-xs text-muted-foreground">Invite a student to lead a faculty, department, or hostel. They'll be auto-approved when they accept.</p>
        <form onSubmit={(e) => { e.preventDefault(); inviteM.mutate(); }} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Email</Label>
            <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="student@school.edu" required />
          </div>
          <div>
            <Label>Scope</Label>
            <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={inviteScope} onChange={(e) => { setInviteScope(e.target.value as "faculty" | "department" | "hostel"); setInviteScopeId(""); }}>
              <option value="faculty">Faculty</option>
              <option value="department">Department</option>
              <option value="hostel">Hostel</option>
            </select>
          </div>
          {inviteScope !== "hostel" ? (
            <div className="sm:col-span-2">
              <Label>{inviteScope === "faculty" ? "Faculty" : "Department"}</Label>
              <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={inviteScopeId} onChange={(e) => setInviteScopeId(e.target.value)} required>
                <option value="">Choose…</option>
                {inviteScope === "faculty"
                  ? scopes.data?.faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)
                  : scopes.data?.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="sm:col-span-2">
              <Label>Hostel name</Label>
              <Input value={inviteRegion} onChange={(e) => setInviteRegion(e.target.value)} placeholder="e.g. Queen Amina Hall" required />
            </div>
          )}
          <div className="sm:col-span-2">
            <Label>Personal note (optional)</Label>
            <Input value={inviteMsg} onChange={(e) => setInviteMsg(e.target.value)} placeholder="Hey — I'd love you to run this for us." maxLength={1000} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={inviteM.isPending}><Send className="mr-1.5 h-4 w-4" /> Send invitation</Button>
          </div>
        </form>

        {/* Pending invitations */}
        <div className="mt-5 space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Invitations ({invites.data?.length ?? 0})</h3>
          {(!invites.data || invites.data.length === 0) && <p className="text-sm text-muted-foreground">No invitations yet.</p>}
          {invites.data?.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{i.invitee_email} · <span className="text-muted-foreground">{scopeLabel(i)}</span></span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${i.status === "pending" ? "bg-primary/15 text-primary" : i.status === "accepted" ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                {i.status}
              </span>
              {i.status === "pending" && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => copyInviteLink(i.token)}><Copy className="mr-1 h-3.5 w-3.5" /> Copy link</Button>
                  <Button size="sm" variant="ghost" onClick={() => revokeM.mutate(i.id)}>Revoke</Button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Applications */}
      <section className="rounded-2xl border border-border/60 bg-card p-5">
        <h2 className="font-display text-2xl">Pending applications</h2>
        <p className="mt-1 text-xs text-muted-foreground">Applications for faculty, department, and hostel ambassador roles at your school.</p>
        <div className="mt-3 space-y-3">
          {(!apps.data || apps.data.length === 0) && <p className="text-sm text-muted-foreground">Nothing pending — you're all caught up.</p>}
          {apps.data?.map((a) => {
            const applicant = (a as { applicant?: { display_name?: string | null } | null }).applicant;
            return (
              <div key={a.id} className="rounded-xl border border-border/60 bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{applicant?.display_name ?? "Applicant"}</p>
                    <p className="text-xs text-muted-foreground">{scopeLabel(a)}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{a.motivation}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => reviewAppM.mutate({ applicationId: a.id, decision: "approve" })} disabled={reviewAppM.isPending}>
                    <Check className="mr-1 h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => reviewAppM.mutate({ applicationId: a.id, decision: "reject" })} disabled={reviewAppM.isPending}>
                    <X className="mr-1 h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sub-ambassadors */}
      <section className="rounded-2xl border border-border/60 bg-card p-5">
        <h2 className="font-display text-2xl">My team</h2>
        <p className="mt-1 text-xs text-muted-foreground">Ambassadors running your faculties, departments, and hostels.</p>
        <div className="mt-3 space-y-2">
          {(!subs.data || subs.data.length === 0) && <p className="text-sm text-muted-foreground">No sub-ambassadors yet — invite your first one above.</p>}
          {subs.data?.map((s) => {
            const user = (s as { user?: { display_name?: string | null } | null }).user;
            const suspended = s.status === "suspended";
            return (
              <div key={s.user_id} className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{user?.display_name ?? "Ambassador"}</p>
                  <p className="text-xs text-muted-foreground">{scopeLabel(s)} · {s.tier}</p>
                </div>
                {suspended
                  ? <Button size="sm" variant="secondary" onClick={() => setStatusM.mutate({ userId: s.user_id, status: "active" })}><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Reinstate</Button>
                  : <Button size="sm" variant="ghost" onClick={() => setStatusM.mutate({ userId: s.user_id, status: "suspended" })}><ShieldX className="mr-1 h-3.5 w-3.5" /> Suspend</Button>}
                {s.tier === "ambassador" && !suspended && (
                  <Button size="sm" variant="secondary" onClick={() => setTierM.mutate({ userId: s.user_id, tier: "senior" })}><ArrowUp className="mr-1 h-3.5 w-3.5" /> Promote</Button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Task completions from sub-ambassadors */}
      <section className="rounded-2xl border border-border/60 bg-card p-5">
        <h2 className="font-display text-2xl">Task reviews</h2>
        <p className="mt-1 text-xs text-muted-foreground">Approve or reject task completions from your team. Approved tasks award Campoints automatically.</p>
        <div className="mt-3 space-y-3">
          {(!completions.data || completions.data.length === 0) && <p className="text-sm text-muted-foreground">Nothing awaiting review.</p>}
          {completions.data?.map((c) => {
            type TaskInfo = { title?: string; reward_points?: number } | null;
            const rawTask = (c as { task?: TaskInfo | TaskInfo[] }).task;
            const task = Array.isArray(rawTask) ? rawTask[0] : rawTask;
            const rawAmb = (c as { ambassador?: { display_name?: string | null } | null }).ambassador;
            return (
              <div key={c.id} className="rounded-xl border border-border/60 bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{task?.title ?? "Task"}</p>
                    <p className="text-xs text-muted-foreground">By {rawAmb?.display_name ?? "Ambassador"}</p>
                    {c.evidence_url && <a href={c.evidence_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary underline">Open evidence →</a>}
                    {c.notes && <p className="mt-1 text-sm">{c.notes}</p>}
                  </div>
                  <span className="whitespace-nowrap rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">+{formatPoints(task?.reward_points ?? 0)}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => reviewCompletionM.mutate({ completionId: c.id, decision: "approve" })}><Check className="mr-1 h-3.5 w-3.5" /> Approve</Button>
                  <Button size="sm" variant="secondary" onClick={() => reviewCompletionM.mutate({ completionId: c.id, decision: "reject" })}><X className="mr-1 h-3.5 w-3.5" /> Reject</Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
