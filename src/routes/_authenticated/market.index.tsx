import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Plus, ShoppingBag, Tag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/market/")({
  component: MarketPage,
});

function naira(n: number) { return "₦" + n.toLocaleString(); }

function MarketPage() {
  const itemsQ = useQuery({
    queryKey: ["market-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_items")
        .select("id, title, description, price_naira, image_url, category, created_at, school:schools(short_name), seller:profiles!marketplace_items_seller_id_fkey(id, display_name, avatar_url)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
            <ShoppingBag className="h-4 w-4" /> Marketplace
          </div>
          <h1 className="mt-1 font-display text-3xl">Buy & sell on campus</h1>
          <p className="text-sm text-muted-foreground">Student-to-student deals. Always meet in a safe public spot.</p>
        </div>
        <Button asChild size="sm" className="brand-gradient text-primary-foreground">
          <Link to="/market/new"><Plus className="mr-1 h-4 w-4" />List item</Link>
        </Button>
      </div>


      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {itemsQ.isLoading && Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-card/60" />)}
        {(itemsQ.data ?? []).map((it) => {
          const seller = Array.isArray(it.seller) ? it.seller[0] : it.seller;
          const school = Array.isArray(it.school) ? it.school[0] : it.school;
          return (
            <article key={it.id} className="overflow-hidden rounded-2xl border border-border/60 bg-card transition hover:border-primary/50">
              <div className="aspect-square bg-cover bg-center bg-muted" style={{ backgroundImage: it.image_url ? `url(${it.image_url})` : undefined }} />
              <div className="p-3">
                <p className="line-clamp-1 text-sm font-medium">{it.title}</p>
                <p className="mt-0.5 text-base font-semibold text-primary">{naira(it.price_naira)}</p>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" />{it.category}</span>
                  {school && <span>{school.short_name}</span>}
                </div>
                {seller && (
                  <Link to="/u/$id" params={{ id: seller.id }} className="mt-2 block truncate text-[11px] text-muted-foreground hover:text-foreground">
                    by {seller.display_name ?? "Student"}
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!itemsQ.isLoading && (itemsQ.data?.length ?? 0) === 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
          <p className="text-sm text-muted-foreground">Nothing listed yet — be the first.</p>
          <Button asChild className="mt-3 brand-gradient text-primary-foreground"><Link to="/market/new">List something</Link></Button>
        </div>
      )}
    </AppShell>
  );
}
