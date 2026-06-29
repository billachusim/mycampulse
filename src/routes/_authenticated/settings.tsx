import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuthUser, useProfile } from "@/lib/profile";
import { toast } from "sonner";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
});

function Settings() {
  const { user } = useAuthUser();
  const { data: profile, refetch } = useProfile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [avatar, setAvatar] = useState(profile?.avatar_url ?? "");
  const [saving, setSaving] = useState(false);

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
  });

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      display_name: name.trim() || null,
      bio: bio.trim() || null,
      avatar_url: avatar.trim() || null,
    }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); refetch(); }
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <AppShell>
      <h1 className="mb-6 font-display text-3xl">Settings</h1>
      <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-5">
        <div>
          <Label>Display name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Avatar URL</Label>
          <Input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <Label>Bio</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving} className="brand-gradient text-primary-foreground">{saving ? "Saving…" : "Save"}</Button>
          <Button variant="secondary" onClick={signOut}>Sign out</Button>
        </div>
        {profile?.verified && <p className="text-xs text-primary">✓ Verified student (school email)</p>}
        {!profile?.verified && <p className="text-xs text-muted-foreground">Verification: use a school email (.edu / .edu.ng / .ac.uk) to get a verified tick on sign-up.</p>}
        {profile?.verified && <p className="text-xs text-primary">✓ Verified student (school email)</p>}
        {!profile?.verified && <p className="text-xs text-muted-foreground">Verification: use a school email (.edu / .edu.ng / .ac.uk) to get a verified tick on sign-up.</p>}
      </div>
      {isAdmin && (
        <Link to="/admin" className="mt-4 flex items-center gap-2 rounded-2xl border border-primary/40 bg-card p-4 text-sm font-medium hover:bg-secondary">
          <Shield className="h-4 w-4 text-primary" /> Open moderation queue
        </Link>
      )}
    </AppShell>
  );
}
