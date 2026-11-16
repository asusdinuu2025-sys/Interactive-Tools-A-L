# Admin Dashboard preview

Base: main at b0470775edb0b33009c040c8de3294f1b4cd1288.

## Included

- Admin Dashboard entry immediately below Manage Announcements. Separate responsive page using the existing theme preference, Nirmala UI and translucent panels.
- Overview, Users, Admins, Content, Sections, Media and Activity tabs.
- Existing admins authorize access through the existing database RPC. Direct navigation fails closed for ordinary accounts.
- Paginated user search, profile summaries (no email/phone disclosure), grant/revoke admin and blue verification badge controls. Verification is independent of admin membership.
- 149 existing content/section records seeded from the current markup, with editing of titles, descriptions, links, thumbnails, visibility and numeric ordering. New simulation cards link to existing implementations or external HTTPS simulations; this does not generate simulation code.
- New homepage sections with card-grid/list layouts, draft preview, separate save/publish, hide/restore, unsaved-change protection and optimistic revision checks.
- JPG/PNG/WebP/PDF media uploads; signature/type/size validation. No HTML/script uploads.
- Home tiles: minimum 138px desktop / 126px mobile, allowed to grow with text; advertisement 240px desktop / 220px mobile. Existing announcement editor, cropping and transitions are unchanged.

## Preview boundaries

`generate-admin-config.mjs` forces branch and deploy previews into preview mode. It cannot enable live operations in a preview even if STUDYLAB_ADMIN_LIVE is set.

The dashboard verifies admin eligibility using the existing server-side `studylab_social_is_admin()` RPC, which currently only authorizes the three specified administrators. It uses the additional `studylab_admin_readonly_stats_v1()` and `studylab_admin_readonly_users_v1()` RPCs to display **real, current Supabase profile, administrator and social-post counts**, and paginated real profiles. No emails or phone numbers are returned. This is deliberately read-only: changing a real user's admin rights or badge is disabled in preview, as are production mutations for content and media. CMS drafts and preview uploads continue to use localStorage on this device only. If the read-only RPCs are absent or unreachable, the page explicitly labels its fallback sample accounts; it never represents sample users as real users. Preview uploads are limited to 1 MB and device storage capacity; live limit is 5 MB. Reset preview changes clears this local state.

Published preview content appears only to a verified admin on the same preview origin/device. Draft Preview opens the target page with an explicit admin preview banner. Existing website functionality outside the new dashboard (including Manage Announcements) retains its current backend behavior; this preview is NOT a sandbox for existing Social, Study Room or announcement actions.

## Backend implementation and production gate

Two independent migrations are included. `20261116142631_admin_readonly_live_preview.sql` installs only admin-checked SELECT-only RPCs to connect the preview to genuine counts and profiles. It does not edit students, posts, roles, privileges on existing tables, announcements or existing admin authorization logic. Its execution requires a separately authorized deployment step. **The larger `20261116070202_admin_dashboard.sql` full editing migration remains unapplied and under review.** It introduces private admin membership, private drafts/activity, public published content and badges, and a restricted media bucket. The existing three admins and four badges are seeded only from matching existing Auth users. Membership changes serialize under a transaction lock, disallow self-removal, update legacy app metadata for existing server endpoints, and use fresh membership checks for RLS. Public RPCs have fixed empty search paths, explicit authenticated-only grants and authorization checks. Ordinary users cannot access the private schema or write public content/badges. Grants/revocations and content operations have transactional activity records.

Before enabling live mode:

1. Apply the migration to an isolated Supabase test database. Test with two admins, an ordinary registered user and a guest, including Storage upload/delete policies and revocation while signed in.
2. Validate existing Social/announcement admin policies and legacy delete-post behavior with newly granted and revoked admins. The endpoint reads fresh Auth metadata; its deployment does not change in this PR.
3. Confirm the three seed admins are present, and run Supabase security/performance advisors. This PR has not run hosted advisors because no hosted database was changed.
4. Check layouts at 360/390/720/721/1180/1360/1440px, 200% zoom, both themes, long names and mobile keyboard. A browser layout pass remains necessary; automated DOM tests are not a substitute for rendering.
5. Obtain production approval, apply the reviewed migration, and set STUDYLAB_ADMIN_LIVE=true only for the production Netlify context. Deploy/branch previews remain isolated regardless.

Never use this PR's migration against production merely to make the preview work.

## Verification

- `node scripts/release-check.mjs`
- `npm ci && npm run test:admin`
- The SQL tests execute the real migration in embedded PostgreSQL (PGlite) with minimal Auth/Storage fixtures. They cover grants, access denial, draft privacy, publication, revision conflicts, unsafe URLs, grant/revoke, self-removal protection and public badge visibility.
- DOM tests exercise the actual dashboard/controller/API with a mocked admin-auth check and assert no remote mutation calls in preview, escaped content, access denial, safe links and all seeded targets.
- Existing announcement JS/CSS are byte-for-byte unchanged.

## Visual design (PR #102 v7)

The Admin Dashboard uses an original Spotify-like dark glass treatment: translucent blur panels, subtle gradients, rounded navigation and cards, high-contrast text, and a large low-opacity ADMIN DASHBOARD watermark. Light and System modes remain supported; no Spotify artwork or music player code is used. HTML/CSS/JavaScript keep the unique `sladmin-` prefix to avoid ad-blocker cosmetic rules.

## Current limits

- New cards are inserted into the chosen supported homepage section or an additional resources area on the selected page. Existing cards keep their original placement; order is within their current parent group. This preserves established categories and functionality.
- Built-in sections keep their original layout. Only newly created sections choose grid/list.
- Activity lists the latest 100 live user/content changes (200 preview entries). Live media changes use Storage logs; they are not currently in the dashboard activity list.
- Media displays the latest 100 files. Removing a file requires confirmation; references are not automatically rewritten.
- The static search index does not automatically include newly database-published cards. Existing indexed resources remain searchable.
- Badges resolve for displayed names in live mode; an already-open page may need reload to reflect a later badge change.
