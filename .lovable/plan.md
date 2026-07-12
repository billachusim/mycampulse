
## Audit: what already exists

**Referral data model (reusable as-is):**
- `profiles.referral_code` (auto-generated 7-char code via `set_referral_code`)
- `profiles.referred_by` (uuid → referrer)
- `campoints_ledger` with reasons `referral_qualified` (200 pts) and `referral_first_post` (50 pts)
- `applyReferralCode` server fn (onboarding + wallet apply flow)
- Wallet page already shows referral code, referrals list, and share link

**Roles:** `app_role` enum = `admin | moderator | user`. `user_roles` table + `has_role()` security definer function. Clean base to extend.

**Analytics:** ledger rows already carry `reason`, `ref_id`, `meta` — enough to count referrals per user. No campus/campaign attribution today.

**Gaps for an ambassador program:**
1. No ambassador role, tier, or state machine (applied / approved / suspended).
2. No application workflow.
3. No campaign / attribution beyond `referred_by`.
4. No aggregation by school / faculty / department / hostel.
5. No ambassador tasks, announcements, or marketing-asset store.
6. No admin review UI.

## Design principles

- **Extend, do not duplicate.** Referral attribution stays on `profiles.referred_by`; ambassador features layer on top.
- **Role via `user_roles`**, not a boolean on profile (per project security rules).
- **Scope is data, not schema.** One ambassador per school today, faculty/department/hostel later, by adding rows — not tables.
- **Attribution is a code, not a person.** A user can be referred by another student *or* by an ambassador campaign; both resolve to a `referred_by` uuid, with optional campaign metadata.

## New database (single migration)

1. `ALTER TYPE app_role ADD VALUE 'ambassador'` (+ optional `senior_ambassador`, `regional_lead` — or keep one role and use `tier` column; plan uses **one role + tier column** to avoid enum sprawl).
2. `ambassador_applications` — user_id, motivation, socials jsonb, status (pending/approved/rejected/suspended), reviewer_id, review_notes, timestamps.
3. `ambassadors` — user_id PK, tier (`ambassador|senior|regional_lead`), scope_type (`school|faculty|department|hostel|region`), scope_id (uuid, nullable for region), region text, status (`active|suspended`), approved_at, approved_by, suspended_at. Unique partial index `(scope_type, scope_id) WHERE status='active' AND tier='ambassador'` to enforce **one primary ambassador per campus**; senior/regional not constrained.
4. `ambassador_campaigns` — id, ambassador_id, code (unique, uppercase), name, landing_path, active, created_at. Codes are distinct from personal `profiles.referral_code`; both resolve through `applyReferralCode`.
5. `ambassador_tasks` — id, title, description, reward_points, starts_at, ends_at, scope filter (jsonb), created_by.
6. `ambassador_task_completions` — task_id, ambassador_id, completed_at, evidence_url, status, reviewer_id.
7. `ambassador_announcements` — id, title, body, audience (`all|tier|scope`), scope filter, published_at, author_id.
8. `ambassador_assets` — id, title, kind (`image|pdf|video|copy`), storage_path (reuses `campus-media` bucket), tier_min, created_at.
9. `signup_attributions` (optional; can be inlined into ledger meta initially) — user_id, referrer_id, campaign_id, campaign_code, source, created_at. Populated when `applyReferralCode` matches a personal code *or* a campaign code.

**Ledger reuse:** add new `campoint_reason` values `ambassador_task_reward`, `ambassador_bonus`. Existing `referral_qualified` / `referral_first_post` continue to fire for personal codes — ambassador campaign codes reuse the same triggers via the `referred_by` link.

All tables: GRANT + RLS. Ambassadors read their own rows; admins full access via `has_role(_user,'admin')`; announcements readable by ambassadors matching audience.

## Server functions (new file `src/lib/ambassador.functions.ts`)

- `applyForAmbassador({ motivation, socials, scope_type, scope_id })`
- `getMyAmbassadorDashboard()` — returns: application status, tier, scope, verified referrals (from ledger `referral_qualified`), active users (referrals with post in last 30d), campus rank, national rank, campaigns w/ counts, task list + completion state, announcements, assets.
- `createCampaign({ name, code, landing_path })`
- `completeTask({ taskId, evidenceUrl })`
- `redeemCampaignCode({ code })` — thin wrapper; teaches `applyReferralCode` to accept campaign codes too (single change to that fn).
- Admin-only (guarded by `has_role`): `reviewApplication({ id, decision, tier?, scope? })`, `promoteAmbassador({ userId, tier })`, `suspendAmbassador({ userId, reason })`, `publishAnnouncement`, `createTask`, `reviewTaskCompletion`, `uploadAsset`.

## Attribution extension (minimal)

Change `applyReferralCode` to:
1. Look up personal code → set `referred_by` (today's behaviour).
2. If not found, look up `ambassador_campaigns.code` → set `referred_by = campaign.ambassador_id` **and** insert a `signup_attributions` row with `campaign_id`.
3. Award the same 200 pts to referrer/ambassador; ambassador gets an additional `ambassador_bonus` if `has_role` matches.

Same code path works for share links `/?ref=CODE` → onboarding prefill (already implemented).

## UI

- `src/routes/_authenticated/ambassador.apply.tsx` — application form (motivation, socials, requested scope).
- `src/routes/_authenticated/ambassador.tsx` — Ambassador Dashboard (only for approved). Reuses `wallet.tsx` referral card patterns and adds:
  - Verified referrals count, active-users count
  - Campus rank / national rank cards
  - Campaigns table with code + copy-link + clicks/signups
  - Tasks list with claim/submit-evidence flow
  - Announcements feed
  - Marketing Assets grid (download links from `campus-media`)
- `src/routes/_authenticated/admin.ambassadors.tsx` (or a tab on existing `admin.tsx`) — pending applications, active ambassador list, promote/suspend actions.
- Wallet page: add a "Become a Campus Ambassador" card when the user is not one yet; link to apply.

## What we reuse (no duplication)

- `profiles.referral_code`, `profiles.referred_by`, ledger, `award_campoints`, `award_for_post` referral trigger.
- `user_roles` + `has_role` for gating.
- `campus-media` bucket for marketing assets.
- Existing `admin.tsx` shell + `wallet.tsx` referral panel components.

## Scale notes

- All ranking queries indexed on `(school_id, referral_count)` via a materialised view refreshed hourly (or SQL view initially; upgrade later).
- No per-school schema — everything keyed by `scope_type/scope_id`, so 500 schools × N ambassadors is just rows.
- Campaign codes are indexed unique; attribution write path is O(1).

## Delivery order

1. Migration: role tier column, tables, RLS, GRANTs, indexes, new ledger reasons.
2. `ambassador.functions.ts` + attribution extension inside `applyReferralCode`.
3. Apply page + dashboard route.
4. Admin review UI.
5. Wallet CTA linking into apply flow.

## Open questions before build

- Add distinct enum values `senior_ambassador` / `regional_lead`, or keep single `ambassador` role + `tier` column? (Plan uses tier column — simpler, no enum migrations later.)
- Should campaign codes and personal referral codes share a single lookup namespace (must be globally unique) or separate? (Plan: single namespace, simpler UX.)
- Approval scope for v1: only `school`, correct? (Plan assumes yes, with schema ready for faculty/department/hostel.)
