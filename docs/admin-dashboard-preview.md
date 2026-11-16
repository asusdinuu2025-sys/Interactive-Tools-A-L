# StudyLab Admin Dashboard · PR #102 release notes

## Scope

The dashboard is a separate admin-only workspace reached from StudyLab's account menu, immediately after Manage Announcements. Tabs: **Overview, Users, Admins, Content, Sections, Media, Activity**.

- Responsive Nirmala UI; Dark, Light and System appearance; translucent gradient glass panels; subtle ADMIN DASHBOARD watermark; no floating developer badge or white account-menu scrollbar.
- Real live user search, paginated accounts, registered/guest indicators and counts; private email and phone fields are never returned.
- Real administrator grants/revocations, blue badge verification, content-card/section editor, JPEG/PNG/WebP/PDF media library, and activity history.
- Existing 149 static content targets remain in place. New cards link to existing simulations or external HTTPS resources; the editor **does not generate simulation programs**.
- Home overview cards use the previously agreed compact heights, advertisement area is taller. Existing Manage Announcements scripts and styling are unmodified.

## Deployment modes

`scripts/generate-admin-config.mjs` selects one of three modes:

| Deployment | Mode | Backend effects |
| --- | --- | --- |
| PR #102 Netlify Deploy Preview (`CONTEXT=deploy-preview`, `REVIEW_ID=102`) | `connected` | Real admin reads **and writes** using server-authorized Supabase RPCs. Confirmation required for changes; **not a sandbox**. |
| Production when `STUDYLAB_ADMIN_LIVE=true` | `live` | Real admin reads and writes after production release. |
| Other previews, local/dev, or production without the opt-in | `preview` | Local preview state only; no new admin database mutations. |

**Important:** PR #102 preview is connected to the **real Supabase production database**. An admin confirming a role change, badge action, publication, file upload or deletion makes a real database change. Ordinary users and unauthorized accounts cannot access the workspace. Do not use connected preview as a throwaway test environment.

## Database rollout already performed (16 November 2026)

- `20261116142631_admin_readonly_live_preview.sql`: read-only admin-scoped account and site metrics.
- `20261116145158_admin_dashboard_live_management.sql`: private admin membership, published badges, draft/content registry, activity log, media bucket and server-checked admin operations.
- Both changes are present in Supabase migration history and the corresponding files are included in PR #102.
- Existing three administrators were seeded from existing Auth roles. The four existing blue badges were preserved. **No additional administrators were granted automatically.**
- `studylab_social_is_admin()` now checks the private membership registry, allowing future grants to work for existing Social/announcement authorization immediately. The gate remains callable by `anon` for existing public RLS policies, but always returns false without an authenticated allowed account.
- The registry is not directly accessible through the browser. Admin-write RPCs are restricted to authenticated callers with server-side membership checks. Admin changes are serialized, self-removal is blocked, and the last remaining administrator is protected. Guest accounts are not eligible.
- Changes to existing profiles, posts and other student records were **not** made during migration. A Supabase post-migration verification confirmed three admin members, four badges, 575 profiles, 32 social posts, an empty published-content registry, an empty draft registry and one admin media bucket.
- A security-advisor warning may flag signed-in callable SECURITY DEFINER RPCs; these endpoints explicitly verify membership and expose no direct table grants. Review them alongside the authorization tests rather than blindly revoking their execute permissions.

## Testing and review

- `node scripts/release-check.mjs`
- `npm ci && npm run test:admin`
- PGlite tests reproduce the actual migration order, unauthorized/authorized access, content validation and publication, grant/revoke, admin membership count updates, and public verification reads.
- DOM tests cover search, preview safety, simulated ad-blocker cosmetic rules, connected admin RPC calls, theme changes and empty/error states.
- Netlify preview builds and automated GitHub release checks are required before production release.
- **Browser verification still required** on desktop/mobile at 360/390/720/1180/1360/1440 px, 200% zoom and all themes. Automated DOM tests do not provide screenshots or real Safari/Edge layout verification.
- Test a small authorized administrator change in the connected preview only after understanding it changes live data. Verify the recipient's privileges and badge visibility independently. Do not test by making unnecessary changes to real students.

## Protection and limitations

- All changes to the live site still require the normal PR merge and production deploy. PR #102 is not automatically merged.
- Existing announcement editor is untouched; its permissions now follow the database admin membership registry.
- A server-published content card is available through the new `studylab_site_content` reader in the connected preview; the production homepage needs the merged client code and `STUDYLAB_ADMIN_LIVE=true` to render new cards.
- The static site search index does not immediately include newly database-published content.
- New cards appear in the targeted supported section or an additional resources area. Built-in sections keep their existing layout.
- Only the most recent 100 activity entries and 100 media objects are shown. Media deletion does not automatically rewrite links to deleted files.
- Verification badges and new admin rights become visible to already-open browser tabs after a refresh or another authenticated update; older open pages can have stale UI.
- Content/permission mutations and media upload/removal are not executed merely by loading the admin dashboard.
