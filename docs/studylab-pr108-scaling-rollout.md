# StudyLab PR #108: safe rollout and rollback

This PR is **preview only**. Code review and test runs do NOT apply any
Supabase migrations to the live project. No study progress, profiles, Social
posts or administrative history is changed by reviewing this PR.

## Preview verification

1. Test the Netlify PR #108 preview in dark and light themes. The flask
   introduction says **StudyLab** in white in both. The four rotating arcs and
   SL icon must remain crisp on forward navigation, reload and Back/Forward.
2. In the preview Admin → Pop-up Messages editor, review the expiry selector:
   24 hours, 7 days, 1 month, 3 months, 6 months, 9 months, 1 year.
3. Verify the GitHub release checks, including isolated PGlite tests.
4. Confirm Live Study Room start/pause/continue/end, cross-device timer,
   60-second away state, day/week totals and top rankings. No artificial
   load should be directed at the live Free-tier project.

## Production rollout: requires separate owner approval

**Order matters**. Do not apply migrations or merge merely because a PR exists.

1. Deploy and verify the new frontend first. Before migrations it detects the
   missing signal table and keeps the original Study Room subscription.
   Existing 24h popup delivery still works; extended expiry choices show a
   clear unavailable-until-migration message.
2. Apply **Stage 1 only**:
   `20261117174500_study_room_realtime_state_signals.sql`
   Adds new signals, their trigger and Realtime publication *without* dropping
   the existing published Study Room members table.
3. With two ordinary authenticated test sessions, verify that Study Room
   start/pause/continue/subject/end changes propagate through the new signal
   channel, while timer credits remain accurate. Monitor Supabase Realtime
   reports, PostgREST errors and browser errors.
4. When the new clients have rolled out and Stage 1 is verified, apply
   **Stage 2**:
   `20261117174530_study_room_disable_heartbeat_publication.sql`
   Stops broadcasting member heartbeats to every subscriber. All original
   timer/study-credit procedures, state and fallback reads stay untouched.
5. Separately, apply the popup migration:
   `20261117175500_admin_popup_selectable_expiry.sql`
   Test all expiry choices and one-time receipts with a **test** message.
   Existing messages retain 24-hour expiry.

**Expiry meaning:** the selected period controls when the notice becomes
ineligible for delivery/claims. Expired rows and audit history are preserved,
as they were previously. It does not silently delete administrator history.

## Rollback

- For a Stage 2 Realtime incident, re-enable the legacy publication with:
  `ALTER PUBLICATION supabase_realtime ADD TABLE public.study_room_members;`
  Stage 1's signal publication may remain active while the old client is
  restored. The 60-second fallback continues refreshing rankings.
- Revert the frontend deployment if needed; the existing study-time RPCs were
  never modified.
- Popup migration is additive; older admin RPCs still use the 24h default.
  Prefer reverting the frontend before any database schema rollback. Do not
  drop user receipts or audit history in a rollback.
- Monitor Realtime message rate and peak connections following migration.
  **Supabase Free's simultaneous connection limit remains unchanged.**
  Lower fan-out reduces messages, not the provider's connection cap.
