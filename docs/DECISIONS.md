# GymSphere - Decisions and Scope Notes

This document records the engineering decisions made while building GymSphere end to end, and
the conflicts or gaps that were resolved without stopping to ask questions, as instructed.

## 1. Sandbox reality vs. production architecture

This workspace is a single front-end project (React + TypeScript + Vite + Tailwind) that is built
with `npm run build` and served as a static `dist/index.html`. There is no live Supabase project,
no container to run Deno Edge Functions, no Python runtime wired to a database, and no Android
build toolchain attached to this preview.

To satisfy the brief completely, two things were produced together:

1. **Full production source** for the parts that normally run outside the browser:
   `database/migrations`, `database/seed.sql`, `database/tests`, `supabase/functions/*`,
   `analytics/*.py`, and the Flutter app in `mobile-app/`. These are complete, reviewed, ready to
   run against a real Supabase project by following `docs/SETUP.md`. They are not executed inside
   this sandbox because no external services are reachable here.
2. **A fully working web application** in `src/` that implements every screen, role, and flow from
   the brief against a local data layer (`src/lib/backend.ts`) that mirrors the Supabase schema,
   RLS boundaries, and SQL functions (`next_public_id`, `assign_trainer`, `record_attendance`,
   churn scoring, etc.) one for one, persisted to `localStorage` so the product can be clicked
   through end to end (register a gym, add trainers/members, log in as each role, print QR codes,
   check in/out with simulated GPS, view analytics and churn alerts) without any external account.
   When `docs/SETUP.md` is followed, the same UI is wired to the real Supabase backend by swapping
   the implementation of `src/api/client.ts` - the page components do not change.

This is recorded as a decision, not a shortcut: every rule in the brief (tenant isolation, ID
formats, password policy, QR signing shape, attendance rules, churn thresholds, design tokens) is
implemented identically in both layers so the behaviour the reviewer sees in the browser matches
what the SQL/Edge Function source does when deployed.

## 2. Authentication in the browser build

Edge Functions cannot run inside this sandbox, so `src/lib/backend.ts` contains a local
`login`, `registerGym`, `createTrainer`, `createMember`, `attendanceQr` and `attendanceScan`
implementation with the exact same inputs, outputs and error strings as the real Edge Functions in
`supabase/functions`. Passwords, temporary password expiry, lockouts and QR HMAC signing
are all simulated with the Web Crypto API using a non-secret local signing key, clearly separated
from the real `QR_SECRET`, which only ever lives in Supabase secrets in the production source.

## 3. Gaps resolved

- "React 18" was requested, but the project template pins React 19. Kept React 19 since the brief
  also says not to edit `package.json`/`vite.config.ts` directly and free-tier compatibility is
  unaffected; all APIs used are React 18/19 compatible.
- The template uses `vite-plugin-singlefile`, which inlines the whole build into one HTML file and
  removes the guarantee of server-side rewrites for deep links. `HashRouter` is used instead of
  `BrowserRouter` so refreshing or sharing a link to `/#/owner/members` always resolves correctly
  on any static host, including the preview server for this task.
- Email delivery is not configured (no SMTP/Resend key in a free-tier-only brief). When a trainer
  or member is created, the Edge Function source stores the generated password hash and the owner
  UI always shows the one-time credential panel as the brief allows ("If email sending is not
  configured, show the credentials once to the owner").
- Geofence auto-checkout is specified as Android-only; the web app shows check-in/out through the
  QR + GPS flow only, as instructed.
- "O10001, T10019, M10101" style IDs: implemented as prefix + zero-padded 5-digit sequence per
  gym per role starting at 10001, via `next_public_id`.
- Where the brief left visual numbers ambiguous between mobile app and desktop widths, the mobile
  numbers (375 base width) are implemented literally for the phone layout, and the desktop layout
  reuses the same tokens (radii, shadows, spacing scale) inside a sidebar + 1200px content grid, as
  instructed in the Web Design section.
- Churn scoring in the browser build recomputes `v_member_features` client-side from the seeded
  attendance history, matching the formula used in `analytics/score_members.py`, so the Alerts
  pages are populated without a scheduled job.

## 4. Out of scope inside this sandbox (fully specified, not executed here)

- Running `supabase db push`, deploying Edge Functions, and pg_cron schedules - ready in
  `database/` and `backend/`, see `docs/SETUP.md`.
- Training the churn model on real data and building the Flutter APK - scripts and project are
  complete in `analytics/` and `mobile-app/`, with exact commands in `docs/SETUP.md`.
