## Goal

Let approved **Campus Ambassadors** (tier=`ambassador`, scope_type=`school`) invite and approve **Faculty / Department / Hostel** ambassadors under their school, without duplicating the existing application/approval architecture used for admin-approved campus ambassadors.

The current schema already supports this — `ambassador_scope_type` already contains `faculty | department | hostel`, and `ambassadors` supports non-primary rows per scope. What's missing is: (1) an invitation/approval path controlled by the campus ambassador (not just admins), (2) sub-ambassador management UI on the campus ambassador dashboard, (3) RLS updates so campus ambassadors can act within their school.

## Design decisions

- **Reuse `ambassador_applications`.** Users still apply through the same table; only the reviewer changes. For faculty/dept/hostel scopes, a campus ambassador at the same `school` reviews it instead of an admin. Admins retain override.
- **Introduce `ambassador_invitations`** as a lightweight table for campus ambassadors to proactively invite a specific user (by email or user_id) to a sub-scope. Accepting the invite creates a pre-approved application → ambassador row. This keeps the "apply" flow and the "invite" flow converging on the same review pipeline.
- **Tier stays `ambassador`; sub-ambassadors are identified by `scope_type != 'school'`.** No new enum values, no new role. The one-primary-per-scope index already covers faculty/dept/hostel uniqueness.
- **Parent linkage is derived, not stored.** A sub-ambassador's "parent" is the active campus ambassador whose `scope_type='school'` matches the sub's `school_id` (looked up via `faculties.school_id`, `departments → faculty → school`, `profiles.school_id` for hostel). This avoids denormalization drift. A helper SQL function `campus_ambassador_for(_scope_type, _scope_id)` returns that user.
- **Rewards & campaigns unchanged.** Sub-ambassadors get their own campaign codes, tasks, and ledger events through the exact same tables. No change to `campoints_ledger` or `signup_attributions`.

## Database changes (single migration)

1. **New table `ambassador_invitations`**
   - `id`, `inviter_id` (campus ambassador), `invitee_email`, `invitee_user_id` (nullable until claimed), `scope_type` (faculty/department/hostel), `scope_id`, `region`, `token` (unique), `status` (`pending|accepted|revoked|expired`), `expires_at`, timestamps.
   - RLS: inviter and invitee can read; inviter can insert/revoke only for their school's sub-scopes; admin full access.
   - GRANTs for authenticated + service_role.

2. **New security-definer helper `public.campus_ambassador_for(_scope_type, _scope_id) → uuid`**
   - Resolves the school for the given sub-scope, returns the active campus ambassador's user_id.
   - Used in RLS policies and server functions.

3. **New helper `public.is_campus_ambassador_for(_user, _scope_type, _scope_id) → boolean`**
   - Wrapper used by policies.

4. **Extend RLS on `ambassador_applications`**
   - Add policy: campus ambassador can `SELECT`/`UPDATE` applications where `scope_type IN (faculty,department,hostel)` and `is_campus_ambassador_for(auth.uid(), scope_type, scope_id)` is true. Only status transitions `pending → approved | rejected` allowed.

5. **Extend RLS on `ambassadors`**
   - Add policy: campus ambassador can `INSERT`/`UPDATE` (suspend, promote to `senior`) rows for sub-scopes under their school.

6. **Extend RLS on `ambassador_task_completions`**
   - Campus ambassador can review completions submitted by ambassadors under their school.

7. **Optional: extend `ambassador_tasks`** so campus ambassadors can create tasks scoped to their school (`created_by = auth.uid()` + `scope.school_id = their school`). Admins still create global tasks.

No changes to `campoints_ledger`, `ambassador_campaigns`, `signup_attributions`, `profiles`, or `app_role`.

## Server functions (extend `src/lib/ambassador.functions.ts`)

- `inviteSubAmbassador({ email, scope_type, scope_id, region? })` — campus ambassador only; creates invitation with token, sends via existing email flow (or returns shareable link if email infra not wired).
- `listMyInvitations()` / `revokeInvitation(id)`.
- `acceptInvitation({ token })` — user-facing; if signed in, creates a pre-approved `ambassador_applications` row (status=`approved`) and an `ambassadors` row atomically; if not signed in, redirect to auth then resume.
- `listPendingSubApplications()` — for campus ambassador dashboard.
- `reviewSubApplication({ application_id, decision, notes })` — approve/reject; on approve, insert `ambassadors` row.
- `listMySubAmbassadors()` — active/suspended sub-ambassadors under this campus.
- `suspendSubAmbassador({ user_id, reason })` / `reinstateSubAmbassador({ user_id })` / `promoteSubAmbassador({ user_id, tier: 'senior' })`.
- `reviewSubTaskCompletion({ completion_id, decision, notes })` — reuses existing award logic.

All check `is_campus_ambassador_for` via RLS + explicit assertion inside handlers.

## UI

**`/ambassador` dashboard (existing) — add "Team" tab, visible only when the current user's row is `scope_type='school'`:**

- **Invite** — form (email + scope picker: faculty/department/hostel + specific scope). Shows list of pending invitations with copy-link and revoke.
- **Applications** — pending faculty/dept/hostel applications for the school; approve/reject inline.
- **My sub-ambassadors** — grouped by scope_type; each row shows tier, status, campaigns count, referrals, points; actions: promote, suspend, message.
- **Task reviews** — completions from sub-ambassadors awaiting approval.

**`/ambassador/apply` (existing)** — add scope selector so faculty/dept/hostel applicants can pick their target scope. If a valid invitation token is in the URL, prefill scope + mark it as invited.

**`/ambassador/invite/$token` (new lightweight route)** — accept invitation; calls `acceptInvitation` after auth.

**Admin dashboard** — unchanged, but the ambassadors tab gets a filter for scope_type so admins can see the whole hierarchy.

## Attribution and rewards

No changes. Sub-ambassadors get personal referral codes and campaign codes through the existing paths. `signup_attributions.campaign_id` already carries the campaign, and `ambassador_bonus` fires for any active ambassador regardless of tier/scope.

## Scaling notes

- Sub-ambassador → campus ambassador lookup is O(1) via `school_id` join; add indexes on `faculties(school_id)`, `departments(faculty_id)` if not already present.
- All new policies use security-definer helpers so RLS stays non-recursive.
- Invitations table stays small (expire + prune job later; not needed for v1).

## Deliverables

1. One migration adding `ambassador_invitations`, two helper functions, and the extended RLS policies.
2. Extended `src/lib/ambassador.functions.ts` with invitation + sub-review functions.
3. New "Team" tab in `src/routes/_authenticated/ambassador.index.tsx`.
4. New route `src/routes/_authenticated/ambassador.invite.$token.tsx`.
5. Small edit to `ambassador.apply.tsx` for scope selection + invite prefill.

## Open question (non-blocking)

Should sub-ambassador **application approval** by a campus ambassador award the same 200-pt referral qualification bonus, or a smaller sub-tier bonus? Default: same reward pool as existing, no new ledger reason.
