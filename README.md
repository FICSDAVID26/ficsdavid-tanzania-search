# FICSDavid Tanzania

**Founder:** David Laurent Mabula

FICSDavid is one expandable digital platform, beginning in Tanzania and designed to grow over time. Search, the shared account, Bundle Services, Wallet and Communication Centre are designed as connected services under one account identity.

## Current implementation status

| Area | Current status |
|---|---|
| Main website interface | Static HTML prototype |
| Kiswahili and English | Basic language switch |
| Search | Limited search integrations |
| Shared account API | Starter routes implemented; deployment and security verification still required |
| Account verification and sessions | Starter workflow; delivery configuration and deployment required |
| Bundle Services | Front-end request preview and D1 schema foundation; no live provider catalogue, price validation, payment or data delivery |
| FICSDavid Wallet | D1 ledger schema foundation only; no active balance, deposits, transfers, withdrawals or payment processing |
| Communication Centre | Shared internet Call, Video Call, Messages and Contacts interface; D1 data foundation only, no live messaging or calls |\n| Ordinary mobile calls and SMS | Website can open the user's native phone dialer and SMS composer; the customer uses their own SIM/operator. FICSDavid does not yet originate calls or send SMS through a gateway |\n| Business SMS / hosted voice | Database foundation only; requires an approved SMS/voice gateway or operator agreement, opt-in/opt-out handling, sender identity approval and regulatory review |
| Mobile money and bank integrations | Not connected |
| Production security review | Not completed |

## One shared account

The account foundation is intended to provide one verified identity for the platform. Bundle, Wallet and Communication services must authorize users through this shared account rather than creating separate disconnected accounts. The existing account API is an initial implementation, not a completed or independently audited authentication product.

## Connected services database foundation

Three D1 migrations are present:

- `0001_account_foundation.sql` — users, verification codes, sessions, rate limits and security events.
- `0002_connected_services.sql` — service preferences, Wallet accounts and immutable ledger entries, Bundle providers/products/orders, contacts, conversations, encrypted-message payload storage, call records, short-lived signalling envelopes and service audit events.\n- `0003_mobile_sms_voice.sql` — opt-in/opt-out records, SMS/voice job tracking, provider webhook receipts, voice session tracking and provider configuration status.

The second and third migrations create data structures only. They do not activate any financial or telecom service. Before applying it to production, test both migrations against a non-production D1 database and review the schema and access policies.

### Wallet safety requirements

Wallet balances must be calculated from balanced, posted double-entry ledger transactions; never trust a balance supplied by the browser. All money-moving operations need server-side authorization, idempotency, transaction limits, reconciliation, audit trails, fraud controls, secure PIN/MFA authorization, failure handling and independent security testing. Real funds must not be accepted until legal/regulatory review and authorized payment-provider agreements are complete.

### Bundle safety and provider requirements

Bundle orders must use server-verified product prices and provider responses. Recipient phone numbers are intended to be encrypted before storage; raw numbers must not be written to logs. Provider credentials belong only in protected server-side secrets. Live orders require an authorized reseller/agency agreement, provider API, payment confirmation, idempotent order processing, delivery-status reconciliation and refund handling.

### Ordinary mobile calls and SMS\n\nThe website's ordinary-call and SMS actions open the handset's native dialer or SMS composer using the user's own SIM. The mobile operator's normal charges apply. This is a device shortcut, not a FICSDavid telecom service. FICSDavid-originated bulk/transactional SMS, branded sender IDs, short codes, hosted voice or customer call routing require an approved provider/operator integration and review of applicable TCRA licensing, numbering and VAS requirements. Marketing messages must be consent-based and provide a working opt-out.\n\n### Communication privacy and real-time requirements

Private messages are represented as encrypted payloads. The application must enforce conversation membership and authorization on every read/write. Key management and encryption must be implemented and reviewed before private messaging is enabled. Voice/video media requires WebRTC plus a suitable TURN service; the D1 signalling table is not a media server. Contacts must remain private to their owner unless explicitly shared.

### SMS API foundation

Authenticated account endpoints are scaffolded at `POST /api/mobile/sms/consent` and `POST /api/mobile/sms/queue`. Consent is recorded separately for service updates and marketing; the queue endpoint currently accepts only service-update messages to the account's own verified phone number, requires prior opt-in, enforces rate limits and an idempotency key, and encrypts the phone number and message before storage.

Before using these endpoints, configure two server-only secrets: `MOBILE_DATA_ENCRYPTION_KEY` and `MOBILE_PHONE_HASH_KEY`, each containing 32 random bytes encoded as base64url. Never expose this key to the browser or commit it to GitHub. The current queue endpoint only records a queued job and returns `delivery: not_enabled`; it does not contact an SMS gateway. A provider adapter, approved provider credentials, delivery-status webhook verification, STOP keyword handling and production security testing are still required. Marketing consent can be recorded, but no marketing campaign or bulk-send endpoint is enabled.

## Cloud deployment setup required

The account API uses a Cloudflare Pages Functions D1 binding named `DB`. The repository contains a database ID in `wrangler.toml`, but its existence and binding in the active Cloudflare account have not been verified here.

1. Confirm the D1 database exists and is the intended project database.
2. Apply migrations in order to a non-production database first, then review and apply to production only after approval.
3. Bind the database to Pages using the exact binding name `DB`.
4. Configure approved email/SMS delivery endpoints and their protected server-side secrets.
5. Deploy and test registration, verification, login, logout, authorization, rate limits and session expiry before opening account registration.
6. Configure payment, bundle and communication providers only after partner approval and security review.

The existing encrypted Cloudflare secret named `RESEND_API_KEY` must remain protected. Never place secret values, passwords, verification codes, Wallet PINs or provider keys in source code, screenshots or chat.

## Important safety information

- The current prototype is not a live Wallet. Do not send money or enter a financial PIN.
- The Bundle form is a preview only. It does not charge a customer or deliver data.
- Internet Communication Centre buttons do not yet place real internet calls, deliver private messages or synchronize contacts. The new ordinary mobile call/SMS shortcuts open the phone's own apps; they do not send through FICSDavid.
- A GitHub commit does not prove that Cloudflare has deployed a change or that a D1 migration has been applied.
- Do not describe any service as live until deployment, integration and end-to-end testing have been verified.

## Founder ownership and governance

The platform should preserve the founder's ownership and administrative control. Any future investment, shareholding, access delegation or transfer of control must be governed by explicit written agreements and role-based permissions. Investor access must not automatically grant access to customer funds, private messages, secrets or production administration.

## Development notes

Build the main platform first and connect services through shared identity, common security policies, consistent audit trails and documented APIs. Keep provider integrations modular so the platform can expand without fragmenting the customer experience.
