# PayHere Lite: StudyLab Plus one-time checkout deployment

**State:** The PayHere activation review is pending and Netlify has paused public traffic. This documentation describes the intended integration, not a live, working payment service.

## One-time plan catalog

| Plus access | Price in LKR | Renewal |
|---|---:|---|
| One month | 199 | Student buys again manually |
| Three months | 499 | Student buys again manually |
| Twelve months | 1,799 | Student buys again manually |

On expiry, Free appearance returns; saved premium choices stay stored. After a subsequently verified renewal, saved choices reappear. No recurring charge, renewal token, or saved card is created.

## Requirements before production

1. Obtain PayHere merchant approval and have the eligible legal merchant holder manage the credentials. PayHere may request a signed agreement correction.
2. Restore the publicly accessible StudyLab website. Netlify currently rejects requests, so a PayHere notify_url would also fail.
3. In the PayHere merchant portal, open Integrations. Locate Merchant ID, use Add Domain/App for the actual public hosting domain, and obtain the domain-specific Merchant Secret after domain approval.
4. Set merchant credentials only in server-side hosting environment settings, never public frontend files or a GitHub commit. Keep sandbox and live credentials distinct; no credentials should be pasted into chat.
5. Create server-side HTTPS endpoints for authenticated order creation and PayHere notification processing. Use a public notify_url, and separate customer return and cancel URLs.
6. In the order endpoint, validate Supabase login, select plan, create an immutable UUID order, and calculate the exact LKR amount on the server. Sign the PayHere request on the server.
7. The PayHere Checkout API receives a POST HTML form with merchant_id, order_id, amount, currency, items, customer details, return_url, cancel_url, notify_url and hash. Recurrence and duration fields must NOT be sent for PayHere Lite.
8. On notification, verify the form-encoded callback checksum, merchant, order, amount, currency and status. The callback signature does NOT cover payment_id, so independently verify the received payment through the provider's Retrieval API before granting benefits.
9. Complete a single database transaction: deduplicate verified receipts, attach payment to the correct account and extend the paid-through date. Never use a success/return page or browser storage to grant a premium role.
10. Monitor refunds, disputes, expired periods and repeat purchases. Test the full sandbox flow, browser refresh, retries and server restarts before enabling live payment services.

## PR #120 preparation code

- scripts/studylab-payhere-lite-checkout.cjs: server-side sandbox-only signed one-time form, 1/3/12-month prices; no recurrence fields.
- scripts/studylab-payhere-lite-verify.cjs: server-side sandbox-only checksum + independent already-retrieved receipt validator; always rejects granting live access.
- scripts/studylab-payhere-lite-*-tests.cjs: price tampering, status, duplicate, refund, invalid callback, no-live-access regression checks.
- Existing recurring checkout prototypes remain future-only. Do not use them on PayHere Lite.

**Still missing:** approved merchant integration, real authenticated Netlify functions and protected entitlement transaction, hosted callbacks, provider API credentials, live browser tests. These modules are deliberately not connected to payment buttons or enabled on the live website.

Official documentation:
- https://support.payhere.lk/api-&-mobile-sdk/checkout-api
- https://support.payhere.lk/api-&-mobile-sdk/retrieval-api
- https://support.payhere.lk/application-process
- https://support.payhere.lk/policy-samples
