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

## PR #102 follow-up: deletion, one-time pop-ups, moderation and card glass

- **Content and Sections:** new and existing custom cards can be permanently deleted with two confirmations. Database drafts and published records are removed; original hard-coded cards use minimal tombstones so the old HTML item does not come back on refresh. Extra sections can be deleted along with their saved dependent cards. Built-in sections remain protected.
- **Shared media safety:** deleting a content record does not automatically erase independently uploaded files in the shared Media library. An image may be referenced by other content; administrators can remove unused uploads separately via Media. This avoids breaking unrelated cards.
- **Pop-up Messages:** a new admin tab creates, edits, previews and deletes scheduled one-time StudyLab notices (info/success/warning/important/custom, four placement choices, 3–30-second display). Every message expires 24 hours after its scheduled start. Authenticated delivery receipts are atomic and unique by popup/account; anonymous devices use local tracking.
- **Moderation:** registered non-admin accounts can be banned/unbanned through the server-authorized `studylab-admin-ban` Supabase Edge Function; duration and reason are logged. Account data is preserved. Admins and guests cannot be banned through this control. A client-side status notice signs suspended users out; already-issued access tokens may exist until expiry, so sensitive server endpoints must keep checking account privileges.
- **Branding:** header shows `ツ` and the StudyLab icon in the Back to StudyLab link.
- **New content glass:** cards and extra sections now have a lighter transparent gradient and neon outline consistent with the existing site; thumbnails are capped at 146px high instead of filling an entire section, and Open resource uses a rounded glass button treatment. Seven content-bearing pages have versioned CSS links so browsers load the updated design.

The additional database migrations `20261116155600_admin_content_delete_v2.sql`, `20261116155627_admin_popup_messages_v2.sql`, `20261116155631_admin_ban_ledger_v2.sql` and the moderation-index migration are installed in Supabase. The ban Edge Function is deployed. No moderation, deletion, or pop-up creation was initiated just by installing the code or running the checks.


## PR #102 polish: editable links and activity controls

- **Card destination:** a bare domain such as `studylablk.netlify.app` is normalized to HTTPS. Standard HTTP/HTTPS pages and internal StudyLab paths are accepted. Unsafe executable schemes (`javascript:`, `data:`, `file:`), embedded credentials and malformed links remain blocked; external images require HTTPS.
- **Card action label:** presets `Open resource`, `Open`, `Open link`, `View`, `Try`, `Learn more`, or custom text up to **22 characters**. Output is rendered as plain text on an auto-sizing glass button.
- **Pop-up link label:** defaults to **View**; accepts `Open`, `Try`, `Read more`, `Learn more`, or a custom label up to **20 characters**. No forced decorative arrow.
- **Overview:** shortcuts use compact inlined SVGs. Only *today's* activity in **Asia/Colombo** appears in Recent activity, with automatic rollover at 00:00 Sri Lanka time. Historical activity is unaffected by the rollover.
- **Activity:** `Clear` hides one entry from the dashboard, and `Clear all` hides all displayed entries. The private audit rows remain stored; neither operation reverses live changes. For new supported content, permission and pop-up actions, `Undo` is enabled only when an atomic before/after snapshot exists. The server compares the current state with that snapshot to reject stale reversals. Old events, bans and cascading section deletions have no automatic Undo. An already delivered pop-up cannot be recalled.
- **UI:** clear high-contrast red Delete controls in light theme, no redundant connected-mode banner, no Overview arrow glyphs, with SVG icons.
- **Database:** migrations `20261116195503_admin_action_labels_and_links.sql` and `20261116195507_admin_reversible_activity.sql` were applied to Supabase after passing isolated PostgreSQL tests. No real users, existing history entries, publications or pop-up rows were changed by installation. Admin undo and history actions are server-authorized; anonymous callers have no EXECUTE privilege.

**Known limit:** A visible Undo is not a generic reversal of every action. History removal never destroys the underlying audit log. Shared media, externally sent notifications and account bans require their own management controls rather than automatic historical rollback. Admins should still confirm any action that changes live data.

