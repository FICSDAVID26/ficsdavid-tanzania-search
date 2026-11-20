# FICSDavid API Integration Contract

**Status:** preparation only. This is not evidence that any provider is connected or approved.

## Server-side configuration convention

For each reviewed provider, Cloudflare server-side environment variables follow:

- `FICSD_PROVIDER_<PROVIDER_ID>_ENABLED` — exact string `true` to opt in.
- `FICSD_PROVIDER_<PROVIDER_ID>_BASE_URL` — HTTPS sandbox or production API base URL.
- `FICSD_PROVIDER_<PROVIDER_ID>_API_KEY` — provider credential, stored as a secret.

Provider IDs currently prepared: `MALIPOPAY`, `SELCOM`, `BEEM`, `DARSMS`, `BUNDLE_AGGREGATOR`, `SEARCH_MONETIZATION`, `AI_PROVIDER`, `WEBRTC_TURN`.

The readiness registry checks configuration shape only. It does not make network calls, validate a credential with the provider, or imply a contract. Its public-safe result deliberately omits the base URL and credential. Do not enable a provider merely because these variables exist.

## First sandbox candidate: Selcom Business API

**Decision:** evaluate Selcom first for documentation and sandbox access only. This is not a production selection, provider agreement, or approval to process customer funds.

The official Selcom Business API portal documents:

- Sandbox base URL: `https://sandbox.selcom.business`.
- Production base URL: `https://api.selcom.business/v1` — do not configure or call production at this stage.
- Credentials are described as available through Selcom Business → My Account → API Credentials.
- The detailed Authorization section specifies RSA-SHA256 signing using an API key and RSA private key. The portal overview also describes HMAC-based digest signing. Selcom must confirm in writing which signing mode and credential bundle applies to the exact Business API account/product FICSDavid would be onboarded to. Do not guess or mix the two schemes.
- The documented protected requests include `api-key`, UTC ISO-8601 `timestamp`, `digest`, `signed-fields`, and an `Origin` header matching a domain registered to the API credential. The portal also documents IP-whitelisting errors and timestamp freshness checks.
- The transaction API describes account lookup, transaction processing and status queries. `transId` must be unique and is used for idempotency/status tracking.
- The documented transaction-process operation is a fund transfer from the debit account associated with the API credentials to a recipient bank/wallet account. This is not, by itself, proof of a consumer checkout/collection product suitable for FICSDavid. Confirm the intended use case and account funding/settlement model with Selcom before designing a user-facing payment flow.
- The callback documentation for this Business API says callbacks are sent for successful transactions and carry `reference_id` and `status`. Do not treat callbacks as a complete event stream for failed or pending transactions; status lookup and reconciliation remain necessary.

Any RSA private key or HMAC secret must remain server-side and must never be placed in browser/mobile code, Git, logs, or client-visible API responses. The current generic registry only models an API key; before implementing this provider, review the credential model and add any required private-key/secret handling securely. No sandbox credentials have been received or tested yet.

Official documentation: https://developer.selcom.business/

## Adapter contract to implement per provider

After receiving written confirmation of the exact API product, official authentication instructions, sandbox credentials and written authorization, implement only the supported operations:

- `healthCheck()`
- `getCapabilities()`
- `quote(request)`
- `createOrder(request, idempotencyKey)`
- `getStatus(externalReference)`
- `verifyWebhook(request)`
- `refundOrReverse(reference, reason)`, only where contractually supported
- `reconcile(period)`

Provider-specific adapters must validate request and response schemas, use server-side timeouts, avoid logging personal or secret data, map provider statuses explicitly, and use idempotency keys for all retryable order creation. Webhooks must verify signatures, timestamps and replay protection before changing an order. The exact webhook authentication scheme must be confirmed for the selected API product; do not assume a signature scheme from a different Selcom product.

## API activation gates

No public route should call a provider until all applicable gates are complete:

1. Written provider authorization, commercial terms and permitted partnership/reseller scope.
2. Confirmation of the exact API product, sandbox credentials and official API/webhook documentation.
3. Data protection, sector regulator and business approvals for the exact service model.
4. Unit, failure, duplicate-event, timeout, reconciliation and security tests.
5. Explicit operator-controlled enablement and successful end-to-end sandbox sign-off.

Payments, wallet custody, airtime, bundles, SMS and telecom services remain inactive by default. Never use customer funds as platform revenue. Preserve the existing `RESEND_API_KEY` secret unchanged.

## Disabled adapter scaffold

The shared `provider-adapter-contract.mjs` module provides a common interface guard and a disabled adapter factory. It is deliberately non-networking: all operations return `PROVIDER_NOT_CONFIGURED`, and the adapter cannot be enabled by mutating its object. This lets FICSDavid wire and test service orchestration before any vendor API credentials or commercial approvals exist.

Do not replace the disabled scaffold with guessed endpoints or undocumented payloads.
