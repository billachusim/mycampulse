import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Compass } from "lucide-react";

export const Route = createFileRoute("/_authenticated/discover")({
  component: Discover,
});

function Discover() {
  const { data: schools = [] } = useQuery({
    queryKey: ["schools-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("id, name, short_name, city, banner_color").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary"><Compass className="h-4 w-4" />Discover</div>
        <h1 className="mt-1 font-display text-3xl">Other campuses</h1>
        <p className="text-sm text-muted-foreground">Peek into another school's feed and connect with students.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {schools.map((s) => (
          <Link
            key={s.id}
            to="/school/$schoolId"
            params={{ schoolId: s.id }}
            className="group overflow-hidden rounded-2xl border border-border/60 bg-card transition hover:border-primary/50"
          >
            <div className="h-20" style={{ background: `linear-gradient(135deg, ${s.banner_color}, #0a0d18)` }} />
            <div className="p-4">
              <h3 className="font-display text-xl">{s.name}</h3>
              <p className="text-xs text-muted-foreground">{s.short_name} · {s.city}</p>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
