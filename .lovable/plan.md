## Goal

Let any signed-in student create events and marketplace listings instantly (same model as timeline posts), with photo uploads and an admin-side moderation queue to hide bad content.

## What I'll build

### 1. Image upload infrastructure
- Create a public storage bucket `campus-media` (5MB limit, image MIME types only).
- RLS on `storage.objects`: anyone can read; authenticated users can upload/update/delete only their own files (path scoped to `{user_id}/...`).
- New helper `src/lib/upload.ts` — `uploadImage(file, folder)` returns public URL. Used by event/listing forms and (later) post composer.
- Lightweight `<ImageUploader />` component with drag/drop + preview, used by both forms.

### 2. Event creation
- New route `src/routes/_authenticated/events.new.tsx` — form: title, cover image, starts_at (datetime), ends_at (optional), location, description, optional community (filtered to user's school).
- Sets `host_id = auth.uid()`, `school_id` from user's primary school.
- Award **+15 Campoints** on event creation (new ledger reason `event_created`, daily cap 2).
- "Create event" FAB on `/events`.
- Edit/delete own event from event card menu.

### 3. Marketplace listing creation
- New route `src/routes/_authenticated/market.new.tsx` — form: title, photo, price (₦), category, condition, description.
- Sets `seller_id = auth.uid()`, `school_id` from profile.
- Award **+10 Campoints** on listing (new ledger reason `listing_created`, daily cap 3).
- "List an item" FAB on `/market`.
- "Mark sold" / delete from owner's own listing card.

### 4. Admin moderation
Extend `/admin` with two new tabs:
- **Events** — paginated list of all events, with Hide / Delete actions. Add `status` column (`active` | `hidden`) defaulting to `active`; public read policy filters `status = 'active'`.
- **Listings** — same pattern for `marketplace_items` (`active` | `hidden` | `sold` — `sold` already exists, just add `hidden`).
- Reports system extended so users can report events and listings, not just posts.

### 5. Small polish
- Tiny "Report" menu item on event cards and marketplace cards (writes to `reports` table with `target_type` of `event` / `listing`).
- Empty-state CTAs on `/events` and `/market` linking to the new create routes.

## Technical notes

- All policy changes use `auth.uid()` directly; no new RPCs needed for the create flows.
- New `campoint_reason` enum values: `event_created`, `listing_created`. New `award_for_event` / `award_for_listing` triggers mirror the existing post trigger.
- Add `status text not null default 'active'` to `events`. Add `'hidden'` as valid value to existing marketplace status check.
- Extend `reports.target_type` to accept `event` and `listing` in addition to `post`.
- Storage paths: `campus-media/events/{user_id}/{uuid}.jpg`, `campus-media/listings/{user_id}/{uuid}.jpg`.
- Client-side: zod validation on both forms; max image 5MB; price ≤ ₦10,000,000.
- No pre-approval, no pending state — matches your "fully open, community moderation" decision from the original product conversation.

## Out of scope (call out)

- Per-image multi-upload galleries on listings (single cover only for v1).
- Editing photo after creation (delete + recreate for v1).
- In-app DMs from listings (sellers already discoverable via profile + existing messaging).
