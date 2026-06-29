import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { Home, Compass, MessageSquare, Users, User as UserIcon, LogOut, Settings, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, initials } from "@/lib/profile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Composer } from "@/components/composer";
import { useQueryClient } from "@tanstack/react-query";
import { BrandLogo } from "@/components/brand-logo";

export function AppShell({ children }: { children: ReactNode }) {
  const { data: profile } = useProfile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [composeOpen, setComposeOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  type NavItem = { to: "/home" | "/discover" | "/connections" | "/messages"; label: string; icon: typeof Home; exact?: boolean };
  const nav: NavItem[] = [
    { to: "/home", label: "Home", icon: Home, exact: true },
    { to: "/discover", label: "Discover", icon: Compass },
    { to: "/connections", label: "People", icon: Users },
    { to: "/messages", label: "Messages", icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/home" className="flex items-center gap-2">
            <BrandLogo size={32} withWordmark wordmarkClassName="text-xl" />
            {profile?.school && (
              <span className="ml-2 hidden rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground sm:inline">
                {profile.school.short_name}
              </span>
            )}
          </Link>
          <div className="flex items-center gap-1">
            <Link to="/settings" className="hidden rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground sm:inline-flex" aria-label="Settings">
              <Settings className="h-5 w-5" />
            </Link>
            <button onClick={signOut} className="hidden rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground sm:inline-flex" aria-label="Sign out">
              <LogOut className="h-5 w-5" />
            </button>
            <Link to="/u/$id" params={{ id: profile?.id ?? "" }} className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-secondary text-xs">{initials(profile?.display_name)}</AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>
      </header>

      {/* Desktop side rail + content */}
      <div className="mx-auto flex max-w-5xl gap-6 px-4 pb-24 pt-6 sm:pb-8">
        <aside className="hidden w-48 shrink-0 md:block">
          <nav className="sticky top-20 flex flex-col gap-1">
            {nav.map((n) => {
              const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link key={n.to} to={n.to} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}>
                  <n.icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
            <button onClick={() => setComposeOpen(true)} className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg brand-gradient px-3 py-2 text-sm font-medium text-primary-foreground">
              <Plus className="h-4 w-4" /> New post
            </button>
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-5">
          {nav.slice(0, 2).map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to} className={`flex flex-col items-center gap-0.5 py-2.5 text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>
                <n.icon className="h-5 w-5" /> {n.label}
              </Link>
            );
          })}
          <button onClick={() => setComposeOpen(true)} className="flex items-center justify-center" aria-label="New post">
            <span className="grid h-11 w-11 -translate-y-2 place-items-center rounded-full brand-gradient text-primary-foreground shadow-lg">
              <Plus className="h-5 w-5" />
            </span>
          </button>
          {nav.slice(2).map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to} className={`flex flex-col items-center gap-0.5 py-2.5 text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>
                <n.icon className="h-5 w-5" /> {n.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <Composer open={composeOpen} onOpenChange={setComposeOpen} />
    </div>
  );
}
