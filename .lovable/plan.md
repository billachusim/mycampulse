# Campulse PWA — MVP Build Plan

"Your Campus Online." School-first social PWA. Web-only for now.

## Decisions locked in (from the conversation)

- Codename **Campulse**, tagline "Your Campus Online"
- School-first feed, not algorithm-first
- Every user belongs to **one primary school**
- Communities inside each school: Faculty, Department, Level (100L–600L), Hostel, Clubs, SUG, Marketplace, Events
- Home feed order: **Your School → Your Communities → Campus Trending**
- **Free-form posting** — no mandatory categories
- Browse other schools, see their trending, connect with people across schools
- Connect → then message (light 1:1 messaging only between connected users)
- **Web-first PWA** (installable, no offline scope yet)
- Mixed-media posts (text, image, short video)
- Fast posting + community moderation (report/hide, no pre-approval)
- Verification optional but valuable (school email badge)
- Students free; monetization deferred

## Scope of this build (MVP v0.1)

Auth + onboarding
- Email/password via Lovable Cloud
- Onboarding: pick **primary school**, faculty, department, level, hostel (optional), display name, avatar
- Optional school-email verification badge (mark email as `.edu`-style domain → verified flag)

Schools & communities
- Seed ~8 pilot Nigerian campuses (UNILAG, UI, OAU, UNN, ABU, UNIBEN, FUTA, Covenant) — editable later
- Auto-membership: user joins their school, faculty, department, level communities on signup
- Browseable community list per school; join/leave Clubs, Hostels, SUG, Marketplace, Events
- Cross-school discovery: `/discover` lists other schools with trending preview

Feed
- `/` Home = three stacked rails: **Your School**, **Your Communities**, **Campus Trending**
- Each post card: author, school + community chip, time, body, media, like / comment / share / report
- Composer (FAB): text + up to 4 images or 1 short video (≤60s), optional community target (defaults to school)

Post detail
- Threaded comments (one level of replies)
- Like, share link, report

People & connections
- Profile page: avatar, school/faculty/dept/level, posts, connections count
- Send / accept / decline connection request
- Connections list

Messaging (light, gated by connection)
- 1:1 chat only between connected users (realtime via Supabase realtime)
- Inbox + thread view
- No group chats, no media in MVP (text only) — keeps scope honest

Trending
- Per-school trending = top posts in last 24h by engagement score
- Campus Trending rail surfaces these

Moderation
- Report post / report user → moderation queue (admin role via `user_roles` table)
- Hide reported post after N reports (threshold), restorable by admin

PWA shell
- Manifest + icons + theme color, `display: standalone`
- No service worker / no offline (per default PWA guidance — installability only)

## Out of scope for v0.1 (deferred volumes)

Group DMs, stories, events RSVP flow, marketplace transactions, push notifications, institution dashboards, paid features, AI ranking, recommendation engine, full search, comments-of-comments, video transcoding pipeline.

## Tech & architecture

- TanStack Start PWA (existing template)
- Lovable Cloud for DB, auth, storage, realtime
- shadcn/ui components, Tailwind v4 design tokens
- Dark, campus-modern visual direction (deep navy + warm accent), Inter for body, distinctive display font for branding (DM Serif Display) — avoids generic AI aesthetic

### Data model (high level)

```text
profiles(id, display_name, avatar_url, primary_school_id, faculty_id,
         department_id, level, hostel_id, verified, created_at)
schools(id, name, short_name, city, country, banner_url)
faculties(id, school_id, name)
departments(id, faculty_id, name)
communities(id, school_id, kind, name, description, created_by)
  -- kind ∈ ('faculty','department','level','hostel','club','sug','marketplace','events')
memberships(user_id, community_id, role, joined_at)
posts(id, author_id, school_id, community_id, body, media, created_at,
      like_count, comment_count, hidden)
post_media(id, post_id, url, kind, position)
comments(id, post_id, parent_id, author_id, body, created_at)
likes(post_id, user_id)
connections(requester_id, addressee_id, status, created_at)
  -- status ∈ ('pending','accepted','declined','blocked')
messages(id, conversation_id, sender_id, body, created_at)
conversations(id, user_a, user_b)  -- canonical ordered pair
reports(id, target_kind, target_id, reporter_id, reason, status)
user_roles(user_id, role)  -- 'admin' | 'moderator' | 'user'
```

RLS on every table. `has_role()` security-definer function for admin checks. GRANTs to `authenticated` + `service_role`; `anon` only on `schools` for the landing page.

### Route map

```text
/                       Home (three feed rails) [auth]
/auth                   Sign in / sign up
/onboarding             School + profile setup
/school/$schoolId       School page + trending
/community/$id          Community feed
/post/$id               Post detail + comments
/compose                Composer (modal route)
/u/$handle              Profile
/connections            Requests + accepted
/messages               Inbox
/messages/$threadId     Thread
/discover               Browse other schools
/notifications          Notifications
/settings               Account + verification
/admin                  Mod queue [admin]
```

## Build order (single pass)

1. Enable Lovable Cloud
2. SQL migration: all tables + RLS + GRANTs + seed schools/faculties/departments
3. Auth + onboarding flow
4. Layout shell (top bar, mobile bottom nav, theme tokens, manifest + icons)
5. Home feed rails + composer + post card
6. Post detail + comments + likes
7. Community + school pages + discover
8. Profile + connections
9. Messaging (realtime, connection-gated)
10. Reports + admin moderation queue
11. PWA manifest polish (icons, theme color, install prompt hint)

Closing: a single short note pointing the user at the running app and the seeded test schools.
