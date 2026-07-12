## Edit profile: display name, bio, avatar

Add an "Edit profile" affordance on the profile page that is visible only when viewing your own profile (`isMe`). It opens a small dialog to update:

- **Display name** — 1–60 chars, trimmed.
- **Bio** — up to 240 chars.
- **Avatar** — upload a new image (JPEG/PNG/WebP, ≤ 2 MB). Client-side downscale to a max 512×512 square before upload to keep files tiny and the feed fast.

### Storage
Create a new **public** storage bucket `avatars` (private `campus-media` uses signed URLs that expire — not suitable for avatars shown across the feed, comments, leaderboard, etc.). Path convention: `avatars/{user_id}/{timestamp}.jpg`. RLS on `storage.objects`:

- Anyone can `SELECT` from `avatars` (public read).
- Authenticated users can `INSERT` / `UPDATE` / `DELETE` only inside their own `{user_id}/…` prefix.

On successful upload, write the public URL into `profiles.avatar_url` and delete the previous avatar object (best-effort). Fall back gracefully if delete fails.

### UI
- On `/u/$id`, add an **Edit profile** button next to the header when `isMe`.
- Dialog with: avatar preview + "Change photo" button, display-name input, bio textarea (with counter), Save/Cancel. Uses shadcn `Dialog`, existing `Input`/`Textarea`/`Button`.
- Optimistic update of `["profile-page", id]` and `["me-profile"]` caches on save.

### Data / validation
- Zod-validated in a small `updateMyProfile` server function (`src/lib/profile.functions.ts`, `requireSupabaseAuth`) that writes `display_name`, `bio`, `avatar_url` to the caller's own `profiles` row — no RLS surprises, plus a server-side length check.
- Avatar upload happens client-side (Supabase JS) into `avatars/{userId}/…`; the resulting public URL is passed to `updateMyProfile`.

### Files
- Add: `src/lib/profile.functions.ts` (server fn).
- Add: `src/components/edit-profile-dialog.tsx`.
- Edit: `src/routes/_authenticated/u.$id.tsx` — mount the dialog + button when `isMe`.
- Tool call: create `avatars` public bucket.
- Migration: RLS policies on `storage.objects` for the `avatars` bucket.

No changes to the `profiles` table schema — all three fields already exist.

If the workspace blocks public buckets I'll surface that and fall back to signed URLs with a longer expiry, but the default plan is public.
