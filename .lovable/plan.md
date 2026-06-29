## Goal
Turn `/discover` from a flat list of school cards into a real **Trending** page that gives users a reason to tap in.

## Changes

### 1. Rename the page intent
- Header changes from "Other campuses" → **"Trending across campuses"** with a secondary line: "What students everywhere are talking about right now."
- Add a small tab bar at the top: **Trending posts · Campuses · Communities** (default = Trending posts).

### 2. Trending posts rail (new — default tab)
Top of the page, before the campus grid:
- Pull the top ~10 posts across all schools from the last 7 days, scored by `like_count * 2 + comment_count * 3` (recency-weighted: divide by `hours_since_post + 6`).
- Render with the existing `PostCard` so likes, share-for-Campoints, and report all keep working.
- "See more" link scrolls to / loads next page.

### 3. School cards — give them a heartbeat
Each card in the Campuses grid gains:
- **Cover strip** — keep the gradient as a fallback, but overlay the most-liked recent post's first image (if any) for that school. Falls back to the gradient when the campus has no image post yet.
- **Live stats row** under the school name: `👥 {member_count} students · 📣 {posts_last_7d} posts this week`.
- **One trending snippet** — the single top post from that school in the last 7 days, shown as a 2-line teaser with author avatar + name + like count. Tapping it opens the post directly (not the school page).
- A subtle "Open campus →" affordance at the bottom keeps the existing school-page navigation.

### 4. People to follow strip (engagement booster)
Below trending posts: a horizontal scroller of 8–12 suggested students you're not yet connected to, weighted toward:
- Same school (if user has one),
- Highest follower / connection count,
- Most active in the last 7 days.

Each chip: avatar, name, school short_name, "Connect" button (reuses existing connection request mutation).

### 5. Trending communities strip
A second horizontal scroller: top 8 communities by new posts in the last 7 days, across all schools. Tapping opens `/community/$id`. Helps users discover clubs / SUG / marketplace activity beyond their own school.

### 6. Empty / quiet states
- If a school has zero posts in the last 7 days → snippet area shows muted "No buzz this week — be the first." instead of being blank.
- If trending posts overall < 3 (e.g. brand new install) → fall back to "Newest from your network" so the page is never empty.

## Technical notes
- All new data fetched via `useQuery` in the component (browser supabase client; RLS already allows authenticated reads on `posts`, `profiles`, `communities`).
- New queries:
  - `trending-posts-global` — single select on `posts` with `profiles!posts_author_id_profiles_fkey`, `schools`, filtered by `created_at > now() - 7d`, sorted in JS by the score above.
  - `school-trending-snippets` — one query that pulls the latest 50 posts of last 7 days with `school_id`, then reduces in-memory to one top post per school (avoids N+1).
  - `suggested-people` — `profiles` left-joined against `connections` to exclude existing ones; limit 12.
  - `trending-communities` — `communities` joined to `posts` count in last 7d.
- No schema changes, no new server functions, no new tables. Pure frontend on top of what's already there.
- Files touched: `src/routes/_authenticated/discover.tsx` (rewrite). Possibly extract small `<TrendingPostMini />` and `<SuggestedPersonChip />` components inline in the same file to keep it self-contained.

## Out of scope (will mention as follow-ups, not building now)
- Replacing the cover image with an AI-picked "image of the week" per campus.
- A real per-school trending score stored in the DB (cron-refreshed).
- Notifications when a post from another campus you peeked at blows up.