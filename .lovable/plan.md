## Goal
Populate the app with realistic-but-clearly-dummy data so you can actually feel Campulse working: a fleshed-out profile for you, a roster of fake students, a busy feed across schools, your connections, pending requests, and active message threads.

## What gets created

### 1. Your profile (admin account)
- Set `display_name`: "Sim Nachu", `handle`: `sim`, `bio`: "Building Campulse · Founder · hops between every campus 👀"
- Avatar: a DiceBear seeded portrait URL
- `primary_school_id` → **UNILAG** (so the "Your School" rail isn't empty for you), `verified = true`, `onboarded = true`
- Join you into UNILAG · Faculty of Engineering, Computer Engineering dept, 400L, and the SUG + Marketplace + Events communities

### 2. Sixteen dummy students across all 8 schools
Spread 2 per school, each with:
- Auth user (placeholder `@campulse.test` email, random password — they will never log in)
- Profile with display name, handle, bio, DiceBear avatar, faculty/dept/level/hostel, verified flag
- Memberships in their school + a couple of communities

Sample personalities so the feed reads naturally:
- Ada (UNILAG, 300L CS), Tunde (UNILAG, 200L Mech Eng), Zainab (ABU, 400L Law), Chuka (UNN, 100L Medicine), Bisi (OAU, SUG VP), Kemi (UI, Theatre Arts), Ifeoma (UNIBEN, Pharmacy), Femi (FUTA, Architecture), David (CU, ICT), plus 7 more.

### 3. ~40 realistic dummy posts
Mixed across schools, communities, and post types — campus gist, lecture rant, hostel chaos, marketplace listing, event flier, lost-and-found, club recruitment, sports banter, exam-week confession, etc. Marked clearly as dummy in body where natural (e.g. ends with "(dummy seed)"). Sprinkle `like_count` and `comment_count` 0–180 so the **Trending** rail has obvious winners. Posts dated across the last 24 hours so they show up in trending.

### 4. Connections
- 6 dummy users are **accepted** connections of yours (so Connections tab shows people)
- 3 dummy users have **pending** requests TO you (so you can accept)
- 2 dummy users you've sent a request to (still pending)
- Plus ~10 connections between the dummies themselves

### 5. Conversations & messages
- 4 active 1:1 conversations between you and your top connections
- Each with 4–7 realistic messages, last_message_at staggered across last 2 days so the inbox has unread-ish ordering
- Sample tone: "yo, are you coming for the SUG debate tonight?", "I dropped the past questions in the group", etc.

### 6. One open report
- A dummy user reports a dummy post for "Spam" — so your `/admin` moderation queue shows a real card to act on.

## How it's delivered
A single seed migration (idempotent-ish, guarded by `ON CONFLICT DO NOTHING` and stable UUIDs) that:
1. Inserts 16 rows into `auth.users` with fixed UUIDs and minimal fields (email, encrypted_password placeholder, confirmed_at, raw_user_meta_data).
2. Inserts matching `profiles` rows.
3. Inserts memberships, posts, likes-bumped counts, connections, conversations, messages, and the one report.
4. Updates your existing profile to the rich version described above.

## Notes
- All dummy emails use `@campulse.test` and a non-functional password hash — they can't actually sign in, they only exist to satisfy FK constraints and look real in the UI.
- Easy to wipe later: a single `DELETE FROM auth.users WHERE email LIKE '%@campulse.test'` cascades through everything.
- Nothing in the app code changes — pure data seed.