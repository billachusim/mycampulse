import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUploader } from "@/components/image-uploader";
import { useProfile } from "@/lib/profile";
import { toast } from "sonner";
import { ShoppingBag } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/market/new")({
  component: NewListingPage,
});

const CATEGORIES = ["Electronics", "Books & Notes", "Hostel & Furniture", "Fashion", "Beauty", "Food", "Services", "Other"];

const schema = z.object({
  title: z.string().trim().min(3, "Add a clear title").max(120),
  description: z.string().trim().max(2000).optional(),
  price_naira: z.number().int().positive("Price must be greater than 0").max(10_000_000, "Price too high"),
  category: z.string().min(1, "Pick a category"),
  image_url: z.string().url().nullable(),
});

function NewListingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error("Sign in first");
      const parsed = schema.parse({
        title,
        description: description || undefined,
        price_naira: Number(price.replace(/[^0-9]/g, "")),
        category,
        image_url: imageUrl,
      });
      const { data, error } = await supabase
        .from("marketplace_items")
        .insert({
          seller_id: profile.id,
          school_id: profile.primary_school_id ?? null,
          title: parsed.title,
          description: parsed.description ?? null,
          price_naira: parsed.price_naira,
          category: parsed.category,
          image_url: parsed.image_url,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Listed · +10 Campoints 🛍");
      qc.invalidateQueries({ queryKey: ["market-all"] });
      qc.invalidateQueries({ queryKey: ["market-rail"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      navigate({ to: "/market" });
    },
    onError: (e: unknown) => {
      const msg = e instanceof z.ZodError ? e.issues[0]?.message : e instanceof Error ? e.message : "Could not create listing";
      toast.error(msg ?? "Could not create listing");
    },
  });

  return (
    <AppShell>
      <div className="mb-5 flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
        <ShoppingBag className="h-4 w-4" /> New listing
      </div>
      <h1 className="mb-1 font-display text-3xl">Sell something on campus</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Reach students at your school. You earn +10 Campoints per listing (max 3/day).
      </p>

      <div className="space-y-5 rounded-3xl border border-border/60 bg-card p-5">
        <ImageUploader value={imageUrl} onChange={setImageUrl} folder="listings" aspect="square" label="Add a clear product photo" />

        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. MacBook Air M1 — 256GB" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="price">Price (₦)</Label>
            <Input
              id="price"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 350000"
            />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="bg-secondary"><SelectValue placeholder="Pick one" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="desc">Description</Label>
          <Textarea
            id="desc" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000}
            placeholder="Condition, accessories included, location for pickup, why you're selling…"
          />
        </div>

        <p className="rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">
          Always meet buyers in a safe public spot on campus. Don't pay before inspecting the item.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => navigate({ to: "/market" })}>Cancel</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !title.trim() || !price || !category}
            className="brand-gradient text-primary-foreground"
          >
            {create.isPending ? "Listing…" : "List item"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
