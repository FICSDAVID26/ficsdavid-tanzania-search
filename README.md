# FICSDavid Tanzania

**Founder:** David Laurent Mabula

FICSDavid is planned as one expandable digital platform, beginning in Tanzania and designed to grow over time. The repository contains an early front-end prototype and the first shared account API foundation.

## Current implementation status

| Area | Current status |
|---|---|
| Main website interface | Basic static HTML page |
| Kiswahili and English | Basic language switch |
| Search | Limited knowledge search plus separate image, video and news search endpoints |
| Shared account API | Starter routes implemented; not live until deployment and configuration |
| Email / phone verification | Code workflow implemented; secure delivery connections still required |
| Password login and sessions | Implemented in starter API; not live until deployment and configuration |
| Account recovery, profile changes and MFA | Not implemented |
| PIN and transaction authorization | Not implemented |
| FICSDavid Wallet and financial ledger | Not implemented; cannot store or transfer money |
| Payments and mobile money | Not implemented |
| Transaction history | Not implemented |
| Voice calls and video calls | Not implemented |
| Private messages and contacts | Not implemented |

## Account foundation

The account foundation is designed for one master account using either a verified email address or an international phone number. The first API routes are:

- `GET /api/health` — checks whether the account API can reach its database.
- `POST /api/auth/request-code` — requests an email or phone verification code.
- `POST /api/auth/verify-code` — verifies a registration code.
- `POST /api/auth/register` — creates an account after contact verification.
- `POST /api/auth/login` — signs in using the verified email/phone and password.
- `GET /api/auth/me` — returns the signed-in account.
- `POST /api/auth/logout` — revokes the current session.

Security measures in this starter include PBKDF2 password hashing, random verification codes stored as salted hashes, short code expiry, limited verification attempts, rate limiting, hashed session tokens, secure HttpOnly cookies, same-origin checks for state-changing requests, and basic security headers.

This is an initial foundation, not a completed or independently audited authentication product. Password reset, multi-factor authentication, account recovery, PIN controls, administrator controls and independent penetration testing remain outstanding.

## Cloud deployment setup required

The API is structured as same-origin Pages Functions and uses a D1 database binding named `DB`.

1. Create a D1 database named `ficsdavid-main` in the deployment account.
2. Replace `REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID` in `wrangler.toml` with the real database ID.
3. Apply the database migration: `npx wrangler d1 migrations apply ficsdavid-main --remote`.
4. Bind that database to the Pages project using the binding name `DB`.
5. Configure the email and SMS delivery endpoints as HTTPS environment variables named `EMAIL_DELIVERY_URL` and `SMS_DELIVERY_URL`. Add their matching secret tokens as `EMAIL_DELIVERY_TOKEN` and `SMS_DELIVERY_TOKEN`.
6. Each delivery endpoint must securely send the supplied one-time code to the requested recipient. Until these endpoints and secrets are configured, registration intentionally fails closed and no account is created.
7. Deploy the Pages project, then test registration, verification, login, logout, rate limits and session expiry in a non-production test environment before opening registration to users.

Do not put delivery tokens, database credentials, passwords, PINs or private keys in source code or commit them to Git.

## Important safety information

- Do not enter passwords, PINs, one-time codes, identity documents or financial details on the current public prototype.
- Do not send money or expect the current Wallet screen to receive, store or transfer funds.
- The account API code in GitHub is not proof that the API has been deployed or configured.
- Search terms may be sent to external search services. Do not submit confidential or sensitive queries.
- Search results can contain third-party content and references. Any legally required creator, source or usage-license attribution must remain visible.

## Wallet and future services

Build the Wallet only after the shared account foundation is deployed and security-tested. Before any real funds are accepted, the platform needs a properly designed financial ledger, transaction authorization, reconciliation, audit logs, fraud monitoring, transaction limits, failure handling, regulatory review and authorized payment connections.

Messaging, contacts, voice and video should use the same authenticated account identity, with appropriate privacy and security controls.

## Development and deployment notes

The repository currently includes a static front end, a Pages Functions account API starter, a D1 migration and deployment configuration. A GitHub commit does not prove that a live website or API has been deployed. Browser testing, API delivery, production security and deployment must be verified separately before describing a feature as live.
