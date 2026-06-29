import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/lib/profile";
import { CalendarDays, MapPin, Users, Check, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/events")({
  component: EventsPage,
});

function fmtDate(s: string) {
  const d = new Date(s);
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function EventsPage() {
  const { user } = useAuthUser();
  const qc = useQueryClient();

  const eventsQ = useQuery({
    queryKey: ["events-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, description, cover_url, location, starts_at, ends_at, rsvp_count, school:schools(id, short_name, name), host:profiles!events_host_id_fkey(id, display_name, avatar_url)")
        .gte("starts_at", new Date(Date.now() - 6 * 3600 * 1000).toISOString())
        .order("starts_at")
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  const myRsvpsQ = useQuery({
    queryKey: ["my-rsvps", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("event_rsvps").select("event_id").eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.event_id));
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ eventId, going }: { eventId: string; going: boolean }) => {
      if (!user) throw new Error("Sign in");
      if (going) {
        const { error } = await supabase.from("event_rsvps").delete().eq("event_id", eventId).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("event_rsvps").insert({ event_id: eventId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.going ? "RSVP removed" : "You're going 🎉");
      qc.invalidateQueries({ queryKey: ["events-all"] });
      qc.invalidateQueries({ queryKey: ["my-rsvps"] });
      qc.invalidateQueries({ queryKey: ["events-rail"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
            <CalendarDays className="h-4 w-4" /> Events
          </div>
          <h1 className="mt-1 font-display text-3xl">This week on campus</h1>
          <p className="text-sm text-muted-foreground">Tap RSVP to save events and earn Campoints for showing up.</p>
        </div>
        <Button asChild size="sm" className="brand-gradient text-primary-foreground">
          <Link to="/events/new"><Plus className="mr-1 h-4 w-4" />Host event</Link>
        </Button>
      </div>

      <div className="space-y-3">
        {eventsQ.isLoading && <div className="h-32 animate-pulse rounded-2xl bg-card/60" />}
        {(eventsQ.data ?? []).map((e) => {
          const school = Array.isArray(e.school) ? e.school[0] : e.school;
          const going = myRsvpsQ.data?.has(e.id) ?? false;
          return (
            <article key={e.id} className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              {e.cover_url && (
                <div className="h-32 bg-cover bg-center" style={{ backgroundImage: `url(${e.cover_url})` }} />
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg">{e.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{fmtDate(e.starts_at)}</span>
                      {e.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span>}
                      {school && (
                        <Link to="/school/$schoolId" params={{ schoolId: school.id }} className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground hover:bg-secondary/80">
                          {school.short_name}
                        </Link>
                      )}
                      <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{e.rsvp_count} going</span>
                    </div>
                    {e.description && <p className="mt-2 text-sm text-foreground/90">{e.description}</p>}
                  </div>
                  <Button
                    onClick={() => toggle.mutate({ eventId: e.id, going })}
                    disabled={toggle.isPending}
                    size="sm"
                    variant={going ? "secondary" : "default"}
                    className={going ? "" : "brand-gradient text-primary-foreground"}
                  >
                    {going ? (<><Check className="mr-1 h-3.5 w-3.5" />Going</>) : "RSVP"}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
        {!eventsQ.isLoading && (eventsQ.data?.length ?? 0) === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
            <p className="text-sm text-muted-foreground">No events yet — be the first to host one.</p>
            <Button asChild className="mt-3 brand-gradient text-primary-foreground"><Link to="/events/new">Host an event</Link></Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
