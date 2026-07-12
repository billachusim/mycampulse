## Native back navigation across sub-pages

Currently `AppShell` renders the same header on every screen with no way to return to the previous page. On top-level tabs (Home, Discover, People, Messages, Wallet) that's fine — the bottom/side nav is the primary way around. On sub-pages (a post thread, a profile, a community, wallet redeem flow, event/market detail, ambassador dashboard, settings, admin, etc.) there's no back affordance beyond the browser gesture, which is invisible on desktop and unreliable inside the in-app webview / Lovable preview iframe.

### Fix
Add a lightweight, automatic back button to the existing `AppShell` header. No layout changes, no new component, no color/typography changes.

- In `src/components/app-shell.tsx`, render a small icon button (`ChevronLeft`, existing header sizing) to the **left of the brand logo**, visible only when the current pathname is a sub-page — i.e. not one of the top-level tabs: `/home`, `/discover`, `/connections`, `/messages`, `/wallet`, `/auth`, `/onboarding`.
- Click behavior: if `window.history.length > 1` and there's a same-origin referrer within the app, call `router.history.back()`. Otherwise fall back to a sensible parent (e.g. `/messages` for `/messages` deep links, `/wallet` for `/redeem/*`, `/events` for `/events/new`, `/market` for `/market/new`, `/home` as a final default). Simple `parentOf(pathname)` helper covers the mapping.
- Keyboard: `aria-label="Back"`, focus ring inherits the existing button styles already used for Settings / Sign out.
- Mobile: the button sits in the same header row (replaces some of the left padding); the brand logo shifts right by ~28px only when the button is visible. No changes to the bottom tab bar.

### Files
- Edit: `src/components/app-shell.tsx` (add derived `showBack`, `handleBack`, and the button).

That's the whole change — no route files touched, no new components, no per-page overrides needed.
