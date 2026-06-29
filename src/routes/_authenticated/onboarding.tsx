import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { applyReferralCode } from "@/lib/campoints.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  validateSearch: (s: Record<string, unknown>) => ({ ref: typeof s.ref === "string" ? s.ref : undefined }),
  component: Onboarding,
});

const LEVELS = ["100L", "200L", "300L", "400L", "500L", "600L", "Postgrad", "Alumni"];

function Onboarding() {
  const { user } = useAuthUser();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const applyRef = useServerFn(applyReferralCode);
  const [name, setName] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [level, setLevel] = useState("");
  const [hostel, setHostel] = useState("");
  const [referralCode, setReferralCode] = useState(search.ref ?? "");
  const [saving, setSaving] = useState(false);

  // Prefill display name
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle().then(({ data }) => {
      setName(data?.display_name ?? user.user_metadata?.display_name ?? "");
    });
  }, [user]);

  const schools = useQuery({
    queryKey: ["onboarding-schools"],
    queryFn: async () => (await supabase.from("schools").select("id, name, short_name").order("name")).data ?? [],
  });

  const faculties = useQuery({
    queryKey: ["onboarding-faculties", schoolId],
    enabled: !!schoolId,
    queryFn: async () => (await supabase.from("faculties").select("id, name").eq("school_id", schoolId).order("name")).data ?? [],
  });

  const departments = useQuery({
    queryKey: ["onboarding-depts", facultyId],
    enabled: !!facultyId,
    queryFn: async () => (await supabase.from("departments").select("id, name").eq("faculty_id", facultyId).order("name")).data ?? [],
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const isEduEmail = !!user.email && /\.(edu|edu\.[a-z]{2,3}|ac\.[a-z]{2,3})$/i.test(user.email);
      const { error } = await supabase.from("profiles").update({
        display_name: name.trim() || null,
        primary_school_id: schoolId || null,
        faculty_id: facultyId || null,
        department_id: departmentId || null,
        level: level || null,
        hostel: hostel.trim() || null,
        verified: isEduEmail,
        onboarded: true,
      }).eq("id", user.id);
      if (error) throw error;

      // Auto-join key communities
      if (schoolId && (level || facultyId || departmentId)) {
        const { data: comms } = await supabase.from("communities").select("id, kind, name").eq("school_id", schoolId);
        const wantedNames: string[] = [];
        if (level) wantedNames.push(`${level.replace("L", " Level")}`);
        const auto = (comms ?? []).filter(c =>
          (c.kind === "level" && wantedNames.includes(c.name)) ||
          c.kind === "sug" || c.kind === "events"
        );
        if (auto.length) {
          await supabase.from("memberships").upsert(
            auto.map(c => ({ user_id: user.id, community_id: c.id })),
            { onConflict: "user_id,community_id" }
          );
        }
      }
      if (referralCode.trim()) {
        try {
          const r = await applyRef({ data: { code: referralCode.trim() } });
          if (r.ok) toast.success("Referral applied — your friend earned 200 Campoints 🎉");
        } catch { /* ignore */ }
      }
      toast.success("All set — welcome to Campulse.");
      navigate({ to: "/home", replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 py-12">
        <h1 className="font-display text-4xl">Welcome.</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tell us where you go — we'll wire up your feed.</p>
        <form onSubmit={save} className="mt-8 space-y-4">
          <div>
            <Label>Display name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Your school</Label>
            <Select value={schoolId} onValueChange={(v) => { setSchoolId(v); setFacultyId(""); setDepartmentId(""); }}>
              <SelectTrigger><SelectValue placeholder="Pick your school" /></SelectTrigger>
              <SelectContent>
                {schools.data?.map(s => <SelectItem key={s.id} value={s.id}>{s.short_name} — {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {schoolId && (
            <div>
              <Label>Faculty</Label>
              <Select value={facultyId} onValueChange={(v) => { setFacultyId(v); setDepartmentId(""); }}>
                <SelectTrigger><SelectValue placeholder="Pick your faculty" /></SelectTrigger>
                <SelectContent>
                  {faculties.data?.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {facultyId && (
            <div>
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue placeholder="Pick your department" /></SelectTrigger>
                <SelectContent>
                  {departments.data?.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger><SelectValue placeholder="Pick your level" /></SelectTrigger>
              <SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Hostel <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={hostel} onChange={(e) => setHostel(e.target.value)} placeholder="e.g. Mariere, Queens, Off-campus" />
          </div>
          <div>
            <Label>Got a referral code? <span className="text-muted-foreground">(optional · earns your friend 200 Campoints)</span></Label>
            <Input value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} maxLength={16} placeholder="e.g. A1B2C3D" className="font-mono tracking-widest" />
          </div>
          <Button type="submit" disabled={saving || !schoolId} className="w-full brand-gradient text-primary-foreground">
            {saving ? "Setting up…" : "Enter Campulse"}
          </Button>
        </form>
      </div>
    </div>
  );
}
