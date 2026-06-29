## 1. Tagline swap — "Your Campus Heartbeat"

Replace the current tagline everywhere it surfaces:
- `src/routes/index.tsx` — landing hero subhead, `head()` title/description, OG/Twitter tags.
- `src/routes/__root.tsx` — default `<title>` + meta description.
- `public/manifest.webmanifest` — `description`.
- `src/routes/auth.tsx` — sidebar tagline.
- `README`/footer copy referencing "Your campus online".

Keep "Campulse" as the brand; only the tagline line changes.

## 2. Campoints v1 — strategy

**Earning rules (rate-limited, anti-spam):**
| Action | Points | Cap |
|---|---|---|
| Daily check-in (open app + tap) | 5 | 1/day |
| 3-day / 7-day / 30-day streak bonus | 10 / 25 / 100 | streak-based |
| Create a post | 10 | 5 posts/day count |
| Comment | 2 | 20/day count |
| Receive a like on your post | 1 | 50/day count |
| Receive a comment on your post | 3 | 30/day count |
| Refer a friend (they sign up + verify school email) | 200 | unlimited |
| Friend's first post earns | 50 bonus | once per referral |
| Share a post externally via tracked link (first click from a new device) | 5 | 10/day count |
| Complete profile (avatar + bio + dept) | 50 | once |
| First-week onboarding quests | 25–100 each | once |

All earn events go through a single `award_campoints(user, reason, amount, ref)` Postgres function that enforces caps server-side. No client can mint points.

**Redemption (v1 launch catalog):**
- **Airtime / Data top-up** (MTN, Glo, Airtel, 9mobile) — pay via VTU provider (Reloadly or Airtimenigeria). Real cost, low fraud risk, instant fulfilment. Default first redemption.
- **Cash to Naira** — withdraw to bank/Opay via Paystack Transfers. Minimum ₦1,000 (= 10,000 Campoints at ₦0.10/point). Requires verified school email + BVN-linked account name match. Manual approval queue for first 30 days, then auto-approve under threshold.

**Conversion rate (starting):** 10 Campoints = ₦1. Tune after pilot.
**Anti-abuse:** unique phone (OTP) at signup, one account per device fingerprint, manual review for >₦5k/week, school-email verification before any cash-out.

## 3. What gets built this turn

**Schema (one migration):**
- `campoints_ledger` — `user_id, delta, reason (enum), ref_type, ref_id, created_at`. Append-only.
- `campoints_balances` — materialized per-user balance (trigger-maintained for fast reads).
- `daily_checkins` — `user_id, date`, unique → enforces 1/day.
- `referrals` — `referrer_id, referred_id, code, status (pending/qualified/rewarded), created_at`.
- `referral_codes` — one stable code per user (e.g. first 6 chars of UUID + handle).
- `share_clicks` — `post_id, sharer_id, fingerprint_hash, created_at` for share-reward dedupe.
- `redemptions` — `user_id, kind (airtime|cash), amount_points, amount_naira, payload jsonb, status (pending/approved/paid/failed/rejected), provider_ref, created_at`.
- `redemption_quests` — seed table for one-time onboarding quests.

Plus a security-definer `award_campoints()` function and triggers on `posts`/`likes`/`comments` that call it with the right cap checks.

GRANTs + RLS on every new public table.

**Server functions (TanStack `createServerFn`, all `requireSupabaseAuth`):**
- `claimDailyCheckin` — awards check-in + streak bonus.
- `getMyWallet` — balance, recent ledger, current streak, referral code/stats.
- `redeemAirtime({ network, phone, amount })` — debits ledger, creates pending `redemption`, calls VTU provider (stubbed if `VTU_API_KEY` not set), updates status.
- `requestCashOut({ amount, bank_code, account_number, account_name })` — debits ledger, queues for admin approval.
- `applyReferralCode({ code })` — called during onboarding; sets `referrer_id` on the new user's profile; awards referrer on qualification.
- `trackShareClick({ post_id, fingerprint })` — public-ish endpoint for tracked share links.

**UI:**
- `src/routes/_authenticated/wallet.tsx` — Campoints wallet: big balance card, "Claim daily +5" button, streak meter, ledger history, "How to earn" accordion, redemption catalog (Airtime / Data / Cash-out), referral card with shareable link + qualified-vs-pending counts.
- Wallet entry in the desktop side rail + a coin chip in the top bar showing live balance (links to `/wallet`).
- `src/routes/_authenticated/redeem.airtime.tsx`, `redeem.cash.tsx` — focused redemption flows with confirmation step.
- `src/routes/_authenticated/onboarding.tsx` — add optional "Got a referral code?" field; award profile-complete points when finished.
- `src/routes/_authenticated/admin.tsx` — add a "Cash-out approvals" tab listing pending `redemptions` (approve / reject / mark paid + paste provider ref).
- `src/components/composer.tsx` — toast on successful post mentions points earned ("+10 Campoints").
- Landing page — add a "Earn Campoints" strip explaining the program (3 cards: post, refer, cash out).

**Realtime:** subscribe wallet page to `campoints_ledger` inserts for the current user so balance ticks up live.

**Secrets:** none required for the v1 build — VTU + Paystack Transfers ship as stubs that mark redemptions `pending` until you're ready to wire providers. We'll add `PAYSTACK_SECRET_KEY` and a VTU provider key in a follow-up turn when you're ready to flip cash-out live.

## 4. Out of scope (next iterations)
- Live VTU/Paystack wiring + KYC/BVN check (need provider accounts + secrets).
- Vendor marketplace (food/printing) and event-ticket redemption — needs a vendor app + QR redemption flow; large surface, separate build.
- Phone OTP at signup (currently email-only). Recommend adding before cash-out goes live.
- Leaderboards, badges, level-ups (motivational layer once ledger is in place).

## 5. Marketing rollout I'd suggest alongside this
- **Campus ambassador program**: top 1 referrer per school each month gets ₦5k bonus; surface a per-school referral leaderboard.
- **Launch quest week**: "Post 3 times + invite 1 friend = ₦200 airtime instantly" — uses the airtime redemption above.
- **Class-rep partnerships**: SUG/class reps get a special badge + 2x referral points for first 50 sign-ups in their dept.
- **WhatsApp-first sharing**: every post has a "Share to WhatsApp" tracked link that pays the sharer per unique click (capped). WhatsApp is how Nigerian campuses actually distribute things.

Want me to also draft the launch-quest copy and an in-app "How Campoints work" page as part of the build? I'll include it if you say yes when approving.
