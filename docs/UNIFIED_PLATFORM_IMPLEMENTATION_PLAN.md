# FICSDavid Unified Platform Implementation Plan

**Status:** Development plan. This document does not claim that external services are live.

## Product rule

FICSDavid is one digital platform with one master account and separate service areas. Service modules must share the account identity, authorization rules, language preferences, navigation and audit conventions. A module must never report a live transaction or delivery unless its provider confirms it.

## Existing repository foundations verified on 2026-11-19

- `index.html` contains the search interface, service information, Help Centre, account UI, Communication Centre, contacts UI, ordinary phone dialer/SMS hand-off and a bundle preview form.
- `functions/api/[[path]].js` routes requests to the shared account API.
- `functions/_shared/account-api.js` contains account registration, login, verification, session, support-ticket and health handling, and delegates contacts and mobile SMS routes.
- `functions/_shared/communication-contacts.js` provides authenticated contact management with encryption at rest.
- `functions/_shared/mobile-messaging.js` is an SMS queue foundation; its own source explicitly says it does not deliver through a provider.
- `migrations/0002_connected_services.sql` creates Wallet/Bundle/Communication schema foundations and explicitly says no money movement or provider delivery is enabled.
- `docs/COMMUNICATION_PRIVATE_MESSAGING_SECURITY.md` says private messaging is design-only; device keys, key lifecycle and client-side end-to-end encryption are not implemented.

## Service completion workstreams

### 1. Shared platform shell and master account
- Keep one account identity across all service areas.
- Centralize session checks, authorization, language preference, account status and audit events.
- Add account recovery and password-reset flows only with verified delivery and abuse controls.
- Ensure every protected API checks ownership server-side; never trust a user ID supplied by the browser.
- Add automated tests for anonymous, authenticated, disabled and cross-account access.

### 2. Search and Help Centre
- Preserve existing search modes and result rendering.
- Add clear loading, empty, provider-error and retry states.
- Add accessible navigation between search, services, account and Help Centre.
- Keep external links safe and explain when a result leaves FICSDavid.

### 3. Bundle Services
- Implement a provider adapter contract for catalogue, price quote, order submission, status lookup, cancellation/refund where supported, and signed provider callbacks.
- Use sandbox/mock adapters for development. Label all mock quotes and orders as TEST.
- Require idempotency keys, server-side price validation, order state transitions and audit records.
- Do not collect or charge money until a licensed/authorized provider and payment flow are configured.
- Never claim a bundle was delivered until the operator/provider confirms it.

### 4. Wallet and payments
- Implement a ledger-first internal architecture: immutable debit/credit entries, balanced journal transactions, idempotency, reconciliation and audit trail.
- Separate available, pending and reserved balances.
- Require authorization, transaction limits, step-up authentication and fraud/risk controls.
- Add payment-provider adapters only after commercial onboarding, credentials, regulatory review and reconciliation procedures.
- Sandbox transactions must be isolated from real balances and clearly marked TEST.
- Do not accept deposits, initiate transfers, or represent wallet balances as spendable before required approvals and independent security review.

### 5. Communication Centre
- Contacts: retain encrypted-at-rest storage and verify authorization, validation and account isolation.
- Private messages: implement device identity/key registration, key lifecycle, authenticated membership, end-to-end encryption, delivery receipts, block/report controls and abuse handling before enabling real private conversations.
- Voice/video: implement WebRTC signalling, STUN/TURN, permission handling, call invitations, expiry, busy/reject/end states and network-failure recovery. Use test-only rooms until operational infrastructure and privacy controls are reviewed.
- Ordinary calls/SMS currently hand off to the phone's dialer/SMS application; this is distinct from FICSDavid-operated telephony.

### 6. Notifications, settings and support
- Add a preference-controlled notification centre with delivery status and user mute controls.
- Keep email/SMS/push delivery behind provider adapters.
- Add per-service preferences while retaining one master account.
- Protect support tickets from cross-account access and avoid logging secrets or message contents.

## Provider adapter contract

Each external integration should expose a small server-side interface with:
- `health()`
- `capabilities()`
- operation-specific methods (for example `quote()`, `submitOrder()`, `getStatus()`)
- normalized success/error responses
- provider request IDs and idempotency handling
- signature verification for callbacks
- structured audit events with secrets and personal data redacted

Provider credentials belong only in encrypted server-side environment secrets. Never commit credentials, request users to paste secret values into chat, or expose them to browser code.

## Development and release gates

1. Work only on a feature branch; do not change production data or secrets as part of ordinary development.
2. Build one coherent vertical slice at a time while keeping the common shell integrated.
3. Run formatting/lint, unit tests, API tests, migration checks and browser smoke tests.
4. Run D1 integration tests against a disposable test database, not production.
5. Test authorization boundaries, replay/idempotency, concurrency, rate limits, input validation and failure recovery.
6. Keep external provider paths in sandbox mode until contracts, credentials, callbacks, compliance and reconciliation are verified.
7. Deploy to preview, inspect logs and smoke-test; production release requires explicit approval.
8. Do not merge stacked pull requests until prerequisite PRs and all required checks pass.

## Acceptance definition

A service is "ready" only when its user flow, backend, database, authorization, failure states, monitoring, tests and operational dependencies are complete. A screen or mock response alone is not a working service. External services remain marked **Integration pending** until a real provider confirms successful operation.
