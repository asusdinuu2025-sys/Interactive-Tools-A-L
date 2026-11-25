# StudyLab Plus final-release gate (2026-11-25)

This document supersedes older "SQL not installed" descriptions in the historic Plus delivery map. PR #119 was merged into main, and the additive Plus foundation and billing ledger migration was installed in the existing Supabase project. This feature branch is **not** a live-billing launch.

## Current rollout states

| Capability | Current state | Release gate |
|---|---|---|
| Existing free StudyLab | GitHub and Supabase preserved; Netlify website paused for usage limits | Restore hosting and smoke-test |
| Plus cosmetic UI, personal reports, and pet/timer options | Code merged to main | Signed-in visual checks and cross-account verification |
| Plus membership schema and grant tools | Installed, rollout disabled by default | Audit RPC permissions, enable only after successful authenticated smoke tests |
| Complimentary Plus | Admin-granted, independent of billing | Verify grant/revoke/expiry with test accounts |
| Payment ledger & admin reports | Schema installed; no payment processor or writer attached | Verified provider credentials, callback and reconciliation |
| Paid checkout, renewals, cancellation | **Not enabled** | Approved eligible merchant account, sandbox and full provider lifecycle |
| Subscription lifecycle simulator | New `scripts/studylab-plus-lifecycle.cjs` | Offline tests in `npm run test:plus-lifecycle` |
| Provider notification verifier | New `scripts/studylab-payhere-verify.cjs` | Server-only sandbox validation; no database writes or access changes |

## Invariants

- Free StudyLab remains free, including study rooms, ranks, guardian moderation, chat, study materials and existing themes. There is no "ad-free" entitlement.
- The existing blue verification badge is not a paid benefit.
- Saved premium cosmetics may be public; the pet and workspace preferences remain private. Preview/demos never grant production membership.
- Paid membership must not be created by browser requests, storage changes, unsigned provider callbacks or sandbox tests.
- A signed PayHere notification is **insufficient alone** to grant access. In the documented checksum, `message_type`, `payment_id` and `subscription_id` are not signed. Independently reconcile the provider payment/subscription before accepting an installment.
- Provider events must be idempotent, authenticated, linked to a server-created immutable order, isolated by environment, and matched to the expected amount and currency.
- Cancellation stops **future billing** at the provider, preserves already-paid access until the authorized paid-through time, and supports grace/failed-payment policies chosen explicitly by the owner.
- Refunds and disputes revoke or recalculate paid entitlement using server-side reconciliation.
- Do not assume Netlify is healthy just because GitHub Actions succeed; Netlify may pause serving all sites when usage credits run out.

## Running the new offline regression tests

```sh
npm run test:plus-lifecycle
npm run test:admin
node scripts/release-check.mjs
```

The lifecycle tests model sandbox renewals, retries, cancellation, expiry, refund, replay and disputes. The PayHere verifier tests the published checksum against a trusted server-side sandbox order. Both modules always report `liveAccess:false`. Neither module sends external requests, changes Supabase, charges a card, or enables an endpoint.

## Work still requiring external credentials or services

1. Restore the suspended Netlify production site or move to a supported hosting provider without altering study-room persistence.
2. Have an eligible, appropriately managed merchant account approved, with subscription support enabled. Store PayHere merchant secrets only in server environment/secrets.
3. Build server-authoritative order creation and an HTTPS callback endpoint. Independently reconcile payment status with PayHere; use an atomic audited database operation for any entitlement grant, separated from complimentary grants.
4. Implement subscription manager cancellation/retry/refund policies, an authenticated self-service membership page, receipts, and retry alerts.
5. Test a **publicly reachable sandbox callback**, multiple installments, duplicate/out-of-order messages, chargebacks, cancel-at-period-end, service restarts, missing configuration, and rollback. Ensure no service role or provider secret is exposed to the browser.
6. Validate mobile/desktop UI and all existing Free features with real authenticated test accounts. Only then enable the server rollout and consider live billing.

**Do not merge or activate billing based only on the offline simulator.**

## Additional independent provider reconciliation

`scripts/studylab-payhere-reconcile.cjs` checks a signed-but-unreconciled sandbox notification against the server-retrieved PayHere Subscription Manager API's subscription list and payment history. The order identifier, subscription identifier, payment identifier, LKR amount and `RECEIVED` capture state must match exactly. Duplicate, missing, failed, refunded or ambiguous provider records are rejected.

**This is intentionally not a live payment handler.** It has no network requests, credentials, database writes or entitlement activation. Even a reconciled receipt does not establish its own paid-through date. An authorized server implementation must calculate the billing interval, handle PayHere sandbox's accelerated installment notifications, use idempotent transactions, and preserve the cancellation/expiry policy before giving the member paid access.

PayHere references verified 2026-11-25:
- Recurring: https://support.payhere.lk/api-%26-mobile-sdk/recurring-api
- Subscription Manager: https://support.payhere.lk/api-%26-mobile-sdk/subscription-manager-api

`npm run test:plus-lifecycle` now runs all three independent test programs: lifecycle, callback signature and provider reconciliation.
