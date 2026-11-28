# Public Plus appearance and ranking bar polish

## Scope

- StudyLab Plus chat bubble colors and fonts, live-card backgrounds, motifs, glow, Plus badges and avatar rings are delivered to other **signed-in and authenticated guest viewers** via the existing bounded public-styles RPC. Private pet/workspace settings are not projected publicly.
- Free users keep the existing live study card's deterministic random neon palette. In daily/weekly rankings, Free users' avatar ring uses the existing male/female accent. Plus members' chosen circular neon avatar ring overrides either type of Free ring in live cards, rankings and chat; the existing gender icon/photo remains.
- Plus Studio now includes a Ranking bars tab: separate daily and weekly colors, plus ranking doodle packs (None, Science, Space, Nature, Music, Books). On the leaderboard, each Plus member's row uses their own public style, and the selected daily or weekly color changes with the board tab. Study time, sorting, crowns and ranks are unchanged.
- Pet robot eye Star and Diamond were removed. Capsule body was replaced by a Teardrop option. The forward migration maps any saved Capsule shape to Teardrop and Star/Diamond eyes to Default. No other saved premium choices are removed.
- On expiry or revocation, public cosmetics fall back to Free, but the saved Plus appearance remains in Supabase for a later verified renewal.

## Database deployment order

1. Baseline Plus foundation was installed in the earlier phase.
2. Apply **supabase/migrations/20261128210000_studylab_plus_public_ranks.sql** as a single transaction. It expands validated, private per-account details to include rankDailyColor, rankWeeklyColor and rankPattern; updates the bounded public projection; and permits anonymous authenticated guests to view **public cosmetics only**. Older clients keep saving supported appearance fields and preserve any ranking colors and doodles already selected.
3. Keep Plus disabled until public web hosting, two-account signed-in testing, and merchant checkout verification are ready.

## Regression checks

- Run npm run test:admin to execute both the original Plus foundation tests and the isolated PGlite + jsdom integration tests.
- Verify daily vs weekly row colors differ without changing score calculations.
- Verify cross-account Plus chat font, bubble, card glow, doodles and ring visibility. Confirm Free/default rows retain original behavior.
- Verify both a signed-in Free viewer and an authenticated guest viewer can see public styles but cannot save or read private pet/workspace settings.
- Verify expired Plus renders Free visually and restores saved style only when a server-confirmed membership resumes.

This is **UI and public-style database preparation only**, not a payment activation or billing launch.
