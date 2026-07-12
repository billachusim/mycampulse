import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  display_name: z.string().trim().min(1, "Name required").max(60),
  bio: z.string().trim().max(240).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const patch: {
      display_name: string;
      bio: string | null;
      avatar_url?: string | null;
    } = {
      display_name: data.display_name,
      bio: data.bio ?? null,
    };
    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url;
    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
