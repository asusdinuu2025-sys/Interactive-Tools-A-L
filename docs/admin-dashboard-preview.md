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

The dashboard uses the existing authenticated session only to verify admin eligibility. New dashboard writes are stored in localStorage under a user-specific owner check, not sent to production. Users/Admins use clearly labelled sample accounts plus a representation of the signed-in admin. Real accounts are not listed or changed. Preview uploads are limited to 1 MB and device storage capacity; live limit is 5 MB. Reset preview changes clears this local state.

Published preview content appears only to a verified admin on the same preview origin/device. Draft Preview opens the target page with an explicit admin preview banner. Existing website functionality outside the new dashboard (including Manage Announcements) retains its current backend behavior; this preview is NOT a sandbox for existing Social, Study Room or announcement actions.

## Backend implementation and production gate

The migration is included for review, NOT applied to any hosted database. It introduces private admin membership, private drafts/activity, public published content and badges, and a restricted media bucket. The existing three admins and four badges are seeded only from matching existing Auth users. Membership changes serialize under a transaction lock, disallow self-removal, update legacy app metadata for existing server endpoints, and use fresh membership checks for RLS. Public RPCs have fixed empty search paths, explicit authenticated-only grants and authorization checks. Ordinary users cannot access the private schema or write public content/badges. Grants/revocations and content operations have transactional activity records.

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

## Current limits

- New cards are inserted into the chosen supported homepage section or an additional resources area on the selected page. Existing cards keep their original placement; order is within their current parent group. This preserves established categories and functionality.
- Built-in sections keep their original layout. Only newly created sections choose grid/list.
- Activity lists the latest 100 live user/content changes (200 preview entries). Live media changes use Storage logs; they are not currently in the dashboard activity list.
- Media displays the latest 100 files. Removing a file requires confirmation; references are not automatically rewritten.
- The static search index does not automatically include newly database-published cards. Existing indexed resources remain searchable.
- Badges resolve for displayed names in live mode; an already-open page may need reload to reflect a later badge change.
