## Overseer — Owner-Only Super Admin

A single, lean control surface reserved for **you** (the app owner). It sits alongside the existing `/admin` page (which stays scoped to routine moderation) and gives you global oversight of every domain in the app: users, posts, comments, events, listings, campaigns, ambassadors, redemptions, reports, campoints, and system health.

The name I'm proposing: **Overseer** (`/overseer`). Short, distinct from "admin" so it doesn't blur with the ambassador/admin flows already in place. Happy to swap it.

### Guiding constraints
- Only you can reach it. Guarded by a dedicated `owner` role (new value in `app_role`), granted to your account only via migration. Even other `admin`s can't enter. Server functions double-check with `has_role(auth.uid(), 'owner')` — never trust the client route guard alone.
- Lean. Every list is **paginated at 10 rows** by default, keyset/offset pagination, lazy per tab (`enabled: tab === X`). No cross-joins beyond one FK hop. No realtime subscriptions here. No aggregate scans over full tables — counts use `head: true, count: 'exact'` only on filtered queries with indexes.
- Read-first. Actions (delete post, cancel campaign, force-suspend ambassador, adjust points, resolve report, refund redemption) are one-click but confirm-gated and go through owner-only server functions.

### Scope of oversight (tabs)
Each tab is a lazy panel. Only the active tab queries data.

1. **Pulse** — a single row of small counters (users today, posts today, active campaigns, pending reports, pending redemptions). Cheap `count` queries only.
2. **Users** — search by email/display name/school. Row actions: view profile, grant/revoke role, suspend, adjust campoints (± with reason → writes to `campoints_ledger`).
3. **Posts** — latest 10, filter by school/flagged. Actions: hide, delete, view reports on it.
4. **Comments** — latest 10, same shape as posts.
5. **Events** — latest 10, filter by status. Actions: cancel, feature, delete.
6. **Listings** — latest 10 marketplace items. Actions: unlist, delete.
7. **Ambassadors** — global view across all schools (campus + sub). Actions: force promote/demote/suspend, override applications, revoke invitations. Reuses existing `ambassador.functions.ts` behind an owner guard.
8. **Campaigns** — all ambassador campaigns across schools. Actions: pause, end, view attributions.
9. **Redemptions** — pending + recent. Actions: approve, reject, mark paid.
10. **Reports** — every open report. Actions: resolve, dismiss, act on target.
11. **Ledger** — recent `campoints_ledger` entries, filterable by reason/user. Read-only.
12. **System** — quick links: linter status placeholder, storage bucket usage (single query), auth settings summary. No heavy scans.

### Data model changes (single migration)
- Extend `app_role` enum with `'owner'`.
- Grant `'owner'` to your `auth.users.id` (looked up by your email) via the migration.
- Add `campoints_ledger` reason `'owner_adjustment'` (new enum value on `campoint_reason`).
- Add an **`admin_audit_log`** table: `id`, `actor_id`, `action` (text), `target_kind`, `target_id`, `meta jsonb`, `created_at`. Every Overseer mutation writes one row. RLS: only `owner` and `admin` can SELECT; only server functions (service_role via server-fn writes) INSERT.
- RLS/policy pass: extend existing policies where needed so `has_role(auth.uid(), 'owner')` implies full access on `posts`, `comments`, `events`, `marketplace_items`, `redemptions`, `reports`, `ambassadors`, `ambassador_applications`, `ambassador_campaigns`, `ambassador_invitations`. `has_role` is already `SECURITY DEFINER` — no recursion risk.
- Grants: `admin_audit_log` gets `GRANT SELECT ON ... TO authenticated` (RLS gates to owner/admin) + `GRANT ALL ... TO service_role`.

### Server functions (new file `src/lib/overseer.functions.ts`)
All use `requireSupabaseAuth` middleware + first line checks `has_role(userId, 'owner')` → throw 403 otherwise. Every mutation appends an `admin_audit_log` entry.

- `overseerPulse()` — returns the 5 counters.
- `overseerListUsers({ q, cursor })`, `overseerAdjustCampoints({ userId, delta, reason })`, `overseerGrantRole`, `overseerRevokeRole`, `overseerSuspendUser`.
- `overseerListPosts({ cursor, schoolId, flagged })`, `overseerDeletePost`, `overseerHidePost`.
- Same shape for comments, events, listings.
- `overseerListRedemptions`, `overseerResolveRedemption({ id, status, note })`.
- `overseerListReports`, `overseerResolveReport`.
- `overseerListCampaigns`, `overseerPauseCampaign`, `overseerEndCampaign`.
- `overseerListLedger({ cursor, userId, reason })`.

Reads default to `.limit(10)` with a cursor param; no full-table scans. Only owner-only reads go through `overseer.functions.ts` — routine ambassador/admin functions stay as-is.

### UI
- New route: `src/routes/_authenticated/overseer.tsx`.
- `beforeLoad` calls a lightweight `overseerCanEnter()` server fn (returns boolean). Non-owners get redirected to `/home`.
- Layout: sticky left rail with the 12 tabs, main panel renders the active tab. Each tab is a small component in `src/components/overseer/`. Tabs load only when clicked (`enabled: tab === '...'`). Pagination: "Load more" button, no infinite scroll.
- Small header shows your name + a red "OWNER" badge so it's visually obvious.
- A tiny hidden entrypoint: a subtle link in `/admin` visible only when `owner=true`, plus direct URL access. Not exposed in the main nav.

### Performance guardrails
- All list queries use existing indexes (I'll add indexes on `posts(created_at)`, `comments(created_at)`, `campoints_ledger(reason, created_at)` if missing — checked in the migration).
- No `select('*')`. Every query projects the minimum columns for the row card.
- `staleTime: 30_000` on read queries; explicit refresh button per tab.
- No cross-tab prefetching, no background polling.

### Files to add / edit
- Add: `supabase/migrations/<ts>_overseer.sql` (role, audit table, policies, indexes, reason enum).
- Add: `src/lib/overseer.functions.ts`.
- Add: `src/routes/_authenticated/overseer.tsx` + `src/components/overseer/*` (one small file per tab).
- Edit: `src/routes/_authenticated/admin.tsx` — show an "Open Overseer" link when the user has `owner` role.
- Edit: `src/integrations/supabase/types.ts` regenerates automatically after the migration.

### Open questions before I build
1. Confirm the name **Overseer** (or pick: Command Center / Control Room / Mission Control / Sovereign).
2. The owner email to bind the `'owner'` role to — you mentioned "you already know my email", but I don't have it in current context. Please paste it so the migration seeds correctly. Without it I'll gate the role but leave the assignment for you to run manually.
3. Should `owner` implicitly inherit `admin` powers everywhere (so you don't need both roles), or keep them separate? Default plan: `owner` is a strict superset — `has_role(uid,'admin')` checks are extended to accept `owner` too via a small helper `has_admin_access(uid)`.
