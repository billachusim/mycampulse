import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Campulse — Your Campus Online" },
      { name: "description", content: "School-first social network. Your school, your communities, your campus trending." },
      { property: "og:title", content: "Campulse — Your Campus Online" },
      { property: "og:description", content: "Your school. Your communities. Your campus trending." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  // If signed in, the feed lives under _authenticated/index — redirect there client-side
  useEffect(() => {
    if (authed) window.location.replace("/home");
  }, [authed]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <BrandLogo size={40} withWordmark wordmarkClassName="text-2xl" />
        <Link to="/auth" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Sign in</Link>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-20 pt-12 sm:pt-20">
        <p className="text-sm uppercase tracking-widest text-primary">For African campuses</p>
        <h1 className="mt-3 font-display text-5xl leading-[1.05] sm:text-7xl">
          Your <span className="text-primary">campus</span><br />online.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          School-first feed. Not algorithm-first. Your school, your communities, your campus trending — in one quiet, fast place built only for students.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/auth" className="rounded-md brand-gradient px-5 py-3 text-sm font-semibold text-primary-foreground">Join your campus</Link>
          <a href="#how" className="rounded-md border border-border px-5 py-3 text-sm text-foreground hover:bg-secondary">How it works</a>
        </div>
      </section>

      <section id="how" className="border-t border-border/60">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 sm:grid-cols-3">
          {[
            { t: "Your School", d: "One primary school per user. Your feed opens to your campus first — not random strangers." },
            { t: "Your Communities", d: "Faculty, Department, Level, Hostel, Clubs, SUG, Marketplace, Events. Auto-joined where it makes sense." },
            { t: "Campus Trending", d: "What people on your campus are actually talking about today. No clickbait pulled from the global feed." },
          ].map((b) => (
            <div key={b.t} className="rounded-2xl border border-border/60 bg-card p-6">
              <h3 className="font-display text-2xl">{b.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="font-display text-3xl">Built for the way students actually post.</h2>
          <ul className="mt-6 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
            <li className="rounded-lg border border-border/60 bg-card p-4">📣 No mandatory categories. Just write.</li>
            <li className="rounded-lg border border-border/60 bg-card p-4">🪪 Verified students get a quiet tick — no pay-to-play.</li>
            <li className="rounded-lg border border-border/60 bg-card p-4">🤝 Connect across schools. Message after a handshake.</li>
            <li className="rounded-lg border border-border/60 bg-card p-4">🛡 Community moderation. No pre-approval delays.</li>
          </ul>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        © Campulse · Your campus online.
      </footer>
    </div>
  );
}
