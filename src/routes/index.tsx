import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand-logo";
import { Coins, Smartphone, Gift } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Campulse — Your Campus Heartbeat" },
      { name: "description", content: "Your Campus Heartbeat. School-first feed, communities, and Campoints that turn campus life into airtime and naira." },
      { property: "og:title", content: "Campulse — Your Campus Heartbeat" },
      { property: "og:description", content: "Your school. Your communities. Get paid in Campoints for showing up." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);
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
          Your <span className="text-primary">campus</span><br />heartbeat.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          School-first feed, communities that match your real campus life, and Campoints that turn posts, comments, and invites into airtime, data, and naira.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/auth" className="rounded-md brand-gradient px-5 py-3 text-sm font-semibold text-primary-foreground">Join your campus</Link>
          <a href="#campoints" className="rounded-md border border-border px-5 py-3 text-sm text-foreground hover:bg-secondary">How Campoints work</a>
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

      <section id="campoints" className="border-t border-border/60 bg-card/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-sm uppercase tracking-widest text-primary">Earn Campoints</p>
          <h2 className="mt-2 font-display text-4xl">Campus life that pays you back.</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Every post, comment, check-in, and invite earns Campoints. Spend them on airtime, data, or cash them out to your bank.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon: <Coins className="h-5 w-5" />, t: "Show up daily", d: "Daily check-ins + post, comment, get liked. Built-in caps so it's real, not spammy." },
              { icon: <Gift className="h-5 w-5" />, t: "Invite a coursemate", d: "Earn 200 Campoints the moment they sign up with your code — plus 50 when they post." },
              { icon: <Smartphone className="h-5 w-5" />, t: "Cash out", d: "Redeem for MTN / Glo / Airtel / 9mobile airtime, data, or naira to any Nigerian bank or fintech." },
            ].map((c) => (
              <div key={c.t} className="rounded-2xl border border-border/60 bg-background p-5">
                <div className="grid h-9 w-9 place-items-center rounded-lg brand-gradient text-primary-foreground">{c.icon}</div>
                <h3 className="mt-3 font-display text-xl">{c.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">10 Campoints = ₦1 · Minimum cash-out ₦1,000 · Anti-abuse caps + manual review on first payouts.</p>
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
        © Campulse · Your campus heartbeat.
      </footer>
    </div>
  );
}
