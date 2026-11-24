# StudyLab Plus delivery map

Base: merged PR #118. Keep all existing free features, account IDs, verification grants, moderation, timer persistence and rankings unchanged.

## Phase 1: foundation (this PR)
- Comparison dialog in own View Profile; preview shows the proposed plans; production hides the entry until server rollout is enabled.
- Separate complimentary membership grants, expiry, audit and admin controls. SQL is staged for review, not applied.
- No card collection, no checkout or automatic verification.
- Blue verified account badge remains an administrator decision; introduce a separate Plus badge in phase 2, with clear meaning.
- Grant, extend or revoke complimentary membership without touching existing verification or future paid entitlement.

## Phase 2: unlocks
One centralized entitlement loader and one upgrade dialog for all locked features. Build and test individually: hide sponsored placements only (not essential announcements); Plus badge; optional profile covers and frames; local backgrounds, colors and doodles; compact timer using existing time state; additional pets; study analytics. Keep free equivalents. Expired memberships fall back without deleting user data. No server feature is authorized solely by local storage.

## Phase 3: recurring payment sandbox
Eligible adult-managed merchant account, provider approval and terms. Use PayHere Recurring API or an approved equivalent. Explicit price and monthly renewal consent; no payment data stored on StudyLab. Server creates immutable order; hosted checkout; validate provider callback signature, merchant, currency, order and amount; verify installment identifiers and deduplicate; paid membership stored independently from complimentary grants. Cancel renewal through the provider; retain paid access through paid period; handle failed payments, refunds, disputes, and account deletion; do not silently change prices. Reconcile subscriptions and support cancellation/receipts. Test duplicate callbacks, out-of-order events, failure/retry, expiry and unauthorized access. No live payment integration until these tests pass and merchant is eligible. Price remains undecided.

## Phase 4: launch
Responsive testing across portrait/landscape, desktop and tablet; Light/Dark/System, Lite Mode; payment sandbox audit; feature rollout controlled server-side. Never make blue verification an automatic purchase outcome, sell personal data or target student ads using their private data.

## Phase 2A preview test instructions
- Open the deploy preview for PR #119 (or serve the branch locally on localhost). Sign in and open your own View Profile. The comparison button does not require the membership SQL in preview.
- Click Get StudyLab Plus, then Try Plus demo. Return to the profile: the badge must say Plus demo. Customize Plus profile opens the preset editor; changes are in memory only, disappear when switching back to Free or reloading, and never change real grants.
- In Free demo, the customize button opens the comparison instead of allowing edits. Switch to Free demo to restore default appearance.
- Compare explicitly sponsored banners in the announcement carousel and announcement-derived social cards. Essential announcements and learning resources are retained. Other ad placements still require inventory and integration before an ad-free claim.
- Real membership: staged SQL adds server-authorized preset storage and a minimal cosmetic profile projection. The rollout remains disabled by default; no database changes have been applied. Test on an isolated database before production, including guest/ordinary user/admin permissions, expiry and revoke, cross-account access, and deleted users.
- The admin dashboard is read-only in preview and offers refresh/status guidance. Existing blue verification remains separate; the Plus badge is currently wired to View Profile, not all social and study-room surfaces.
- Billing remains disabled. Do not merge until checks pass and the remaining features and payment sandbox have been tested.
