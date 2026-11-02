# StudyLab release readiness

Release candidate branch: `release/studylab-ready-2026-11-02`

This branch consolidates the changes from PR #72 and PR #73 on top of the production `main` history. It is a release candidate; opening this PR does not deploy to production.

## Audit evidence

Checked on 2026-11-02:

- Netlify reported successful deploy-preview status for PR #72 at commit `23f8ee6` and PR #73 at commit `026e7f0`.
- The connected production Supabase project reported 40 applied migrations. The release-candidate branch contains the corresponding 40 migration source files.
- The production `study_room_members.today_time` and `week_time` columns are generated columns. The live `study_room_heartbeat()` definition updates only the underlying seconds/date columns.
- Both `study-room-pause-stale-sessions` and `study-room-expire-paused-sessions` cron jobs were present and active on a one-minute schedule.
- The production `study_room_live` view exposes the session-expiry state used by the client-side personal tracker.
- Social publishing uses the authenticated `studylab_social_publish_own_post` RPC. The existing database policies still enforce ownership, published-post visibility, image ownership and admin deletion. The unused social moderation Edge Function is removed by PR #73; the existing migration history is retained.

## Automated checks added in this PR

The new `scripts/release-check.mjs` and GitHub Actions workflow check:

- Required core pages and their local stylesheet/script references.
- Mobile viewport zoom support on the core pages.
- `noindex` directives on the private Study Room and detached Mini Timer pages.
- JavaScript syntax in the changed Study Room/Social scripts and inline Study Tools scripts.
- Sitemap XML declaration, duplicate URLs, expected origin and local target existence.

The workflow runs on pull requests to `main` and pushes to `main`. Its result must be green before merging this release candidate.

## Final manual browser smoke test

These checks cannot be certified from repository inspection or a successful static deploy preview. Run them against the PR #75 Netlify preview before production deployment:

- [ ] Desktop and mobile homepage layout, dark/light themes and navigation.
- [ ] Profile completion modal, mobile keyboard/zoom and save validation.
- [ ] Study Room Start, Pause, Resume and End; confirm displayed time and personal tracker agree.
- [ ] Switch to another browser tab and another application; confirm the session continues.
- [ ] Open the detached Mini Timer, close only the main room tab, and confirm the detached timer continues.
- [ ] Close the last Study Room page while studying; confirm the leave warning, saved pause and cancelled-navigation recovery.
- [ ] Confirm a browser crash/forced close is eventually handled by the server watchdog without retaining abandoned-session credits.
- [ ] Confirm daily/weekly rankings refresh and Sri Lanka midnight/week-boundary behavior.
- [ ] Social feed: create text and image posts, verify 4-image/4 MB limits, like/unlike, add/delete comments, delete own post, and verify admin deletion.
- [ ] Confirm deleted content disappears without a full feed reload and feed scroll/open comment state remains stable.
- [ ] Verify the site sitemap, robots directives, canonical metadata and key pages on the deployed preview.

## Release decision

**Current state: release candidate prepared; manual browser smoke test and PR #75 automated workflow result are still pending.**

Do not treat a successful Netlify deploy preview as proof that timer lifecycle, cross-tab behavior, Supabase permissions or all interactive features have passed runtime testing. Merge PR #75 only after the automated check is green and the manual checklist is completed.
