# StudyLab Plus delivery map

Base: merged PR #118. Keep all existing free features, account IDs, verification grants, moderation, timer persistence and rankings unchanged.

## Phase 1: foundation (this PR)
- Comparison dialog in own View Profile; preview shows the proposed plans; production hides the entry until server rollout is enabled.
- Separate complimentary membership grants, expiry, audit and admin controls. SQL is staged for review, not applied.
- No card collection, no checkout or automatic verification.
- Blue verified account badge remains an administrator decision; introduce a separate Plus badge in phase 2, with clear meaning.
- Grant, extend or revoke complimentary membership without touching existing verification or future paid entitlement.

## Phase 2: unlocks
One centralized entitlement loader and one upgrade dialog for all locked features. Build and test individually: keep sponsored placements identical on both plans; Plus badge; optional profile covers and frames; local backgrounds, colors and doodles; compact timer using existing time state; additional pets; study analytics. Keep free equivalents. Expired memberships fall back without deleting user data. No server feature is authorized solely by local storage.

## Phase 3: recurring payment sandbox
Eligible adult-managed merchant account, provider approval and terms. Use PayHere Recurring API or an approved equivalent. Explicit price and monthly renewal consent; no payment data stored on StudyLab. Server creates immutable order; hosted checkout; validate provider callback signature, merchant, currency, order and amount; verify installment identifiers and deduplicate; paid membership stored independently from complimentary grants. Cancel renewal through the provider; retain paid access through paid period; handle failed payments, refunds, disputes, and account deletion; do not silently change prices. Reconcile subscriptions and support cancellation/receipts. Test duplicate callbacks, out-of-order events, failure/retry, expiry and unauthorized access. No live payment integration until these tests pass and merchant is eligible. Price remains undecided.

## Phase 4: launch
Responsive testing across portrait/landscape, desktop and tablet; Light/Dark/System, Lite Mode; payment sandbox audit; feature rollout controlled server-side. Never make blue verification an automatic purchase outcome, sell personal data or target student ads using their private data.

## Phase 2A preview test instructions
- Open the deploy preview for PR #119 (or serve the branch locally on localhost). Sign in and open your own View Profile. The comparison button does not require the membership SQL in preview.
- Click Get StudyLab Plus, then Try Plus demo. Return to the profile: the badge must say Plus demo. Customize Plus profile opens the preset editor; appearance is scoped to this preview tab and signed-in user, survives navigation and reload in that tab, and never changes real grants. Switch back to Free to reset the demo.
- In Free demo, the customize button opens the comparison instead of allowing edits. Switch to Free demo to restore default appearance.
- Sponsored announcements and the Sponsored Telegram section remain available in both plans. There is no ad-free entitlement.
- Real membership: staged SQL adds server-authorized preset storage and a minimal cosmetic profile projection. The rollout remains disabled by default; no database changes have been applied. Test on an isolated database before production, including guest/ordinary user/admin permissions, expiry and revoke, cross-account access, and deleted users.
- The admin dashboard is read-only in preview and offers refresh/status guidance. Existing blue verification remains separate; the Plus badge is wired to View Profile and shared name decoration on the home and study-room pages. Verify individual social and study-room surfaces after deployment.
- Billing remains disabled. Do not merge until checks pass and the remaining features and payment sandbox have been tested.

Phase 2B: compact comparison on desktop, scroll fallback on small screens; 12 illustrated or gradient cover presets with floating motifs (reduced-motion and Lite Mode respected), eight ring presets and validated custom hex colors. The updated migration is staged, not installed. Billing and production activation remain disabled.

## Phase 2C: shared cosmetics and corrections
- The comparison replaces ad-free with shared live-card effects and chat bubble colors. Use Customize Plus profile to select them. Active members' public cosmetics are returned through a bounded server read projection, without billing data; demo changes are visible only to the signed-in preview tab, not other students.
- Leaderboard names, subject labels and badges have separate selectors. Verify the badge stays inline during timer refreshes and that ranks and subjects are unchanged.
- In the Pet menu on Home and Study Room, select a premium robot skin. In the mini timer, select Standard, Compact or Micro. All existing timer actions use the same session API. These are early pet/timer features, not a claim that the entire later milestones are finished.
- The rebuilt SQL must be executed and tested on an isolated database before rollout. Verify expiry/revocation, unauthorized writes, cross-account read projection, unchanged Free experience, and two-account cosmetic rendering. No real grants or payments have been enabled.

## Phase 2D: Studio, plan durations and visual corrections
- Open own View Profile → Plus Studio; Free and Plus can preview all cover, ring, study-card, chat-bubble, pet and timer options without saving. Default-only Free drafts close without prompting; Apply with premium selections opens the existing plan comparison. Dismiss the comparison to retain your draft; after enabling the demo, press Apply again. Real accounts need server-verified membership. Closing the Studio discards changes.
- Proposed price display: LKR 199 monthly, 499 every three months, 1,799 yearly. These are display-only, not checkout, charges, or a commitment to launch price; recurring plan selection must be validated on the server during the billing phase.
- Pet Studio adds body shape, eye shape, eye colour, aura, mouth and shell finish. Timer adds accent and layout across the in-page, Picture-in-Picture, and independent window paths; browser window resizing depends on browser support.
- Live cards use separate name text and inline badge elements; premium gradients override room-theme backgrounds without changing study state. Chat header permits ring overflow and truncates long names separately. Test light/dark, compact screen and long names.
- Demo drafts and saved demo cosmetics remain tab-scoped; independent window demo inheritance varies with browser sessionStorage behavior. Public cosmetics use the existing bounded projection; private details are validated by the staged SQL and not projected to other accounts.
- Release gate: database migration is staged only; test real membership, cross-account visibility, expiry/revocation, and browser UI before production. No ad-free entitlement or real payments.

## Phase 2E: Telegram-inspired polish
- Blue verification precedes Plus. The Studio uses a single horizontal category row, controls on the left and account preview on the right (stacked on narrow screens), with fixed Apply and Reset controls. The real account name and avatar use existing profile/avatar APIs.
- Free Apply is locked and opens the plans even for a default-only draft. Custom colours use a matching tile and palette. Profile and card motifs are original vector line art; public style choices include card glow and chat typeface. Timer custom glow and Studio timer tab are retired; existing compact/micro selector remains in the mini timer and follows theme accents.
- Account menu entry is membership-aware: Try StudyLab Plus / Plus Studio Customizations. Production rollout and payments remain disabled; test signed-in visuals and real cross-account styles before launch.
