# FICSDavid API Integration Contract

**Status:** preparation only. This is not evidence that any provider is connected or approved.

## Server-side configuration convention

For each reviewed provider, Cloudflare server-side environment variables follow:

- `FICSD_PROVIDER_<PROVIDER_ID>_ENABLED` — exact string `true` to opt in.
- `FICSD_PROVIDER_<PROVIDER_ID>_BASE_URL` — HTTPS sandbox or production API base URL.
- `FICSD_PROVIDER_<PROVIDER_ID>_API_KEY` — provider credential, stored as a secret.

Provider IDs currently prepared: `MALIPOPAY`, `SELCOM`, `BEEM`, `DARSMS`, `BUNDLE_AGGREGATOR`, `SEARCH_MONETIZATION`, `AI_PROVIDER`, `WEBRTC_TURN`.

The readiness registry checks configuration shape only. It does not make network calls, validate a credential with the provider, or imply a contract. Its public-safe result deliberately omits the base URL and credential.

## Adapter contract to implement per provider

After receiving official documentation and sandbox access, implement only the supported operations:

- `healthCheck()`
- `getCapabilities()`
- `quote(request)`
- `createOrder(request, idempotencyKey)`
- `getStatus(externalReference)`
- `verifyWebhook(request)`
- `refundOrReverse(reference, reason)`, only where contractually supported
- `reconcile(period)`

Provider-specific adapters must validate request and response schemas, use server-side timeouts, avoid logging personal or secret data, map provider statuses explicitly, and use idempotency keys for all retryable order creation. Webhooks must verify signatures, timestamps and replay protection before changing an order.

## API activation gates

No public route should call a provider until all applicable gates are complete:

1. Written provider authorization, commercial terms and permitted reseller/partnership scope.
2. Sandbox credentials and official API/webhook documentation.
3. Data protection, sector regulator and business approvals for the exact service model.
4. Unit, failure, duplicate-event, timeout, reconciliation and security tests.
5. Explicit operator-controlled enablement and successful end-to-end sandbox sign-off.

Payments, wallet custody, airtime, bundles, SMS and telecom services remain inactive by default. Never use customer funds as platform revenue. Preserve the existing `RESEND_API_KEY` secret unchanged.

## Disabled adapter scaffold

The shared `provider-adapter-contract.mjs` module provides a common interface guard and a disabled adapter factory. It is deliberately non-networking: all operations return `PROVIDER_NOT_CONFIGURED`, and the adapter cannot be enabled by mutating its object. This lets FICSDavid wire and test service orchestration before any vendor API credentials or commercial approvals exist.

For the first live adapter, select a provider only after its official sandbox documentation, credential method, webhook signature specification, order lifecycle, refund rules and written authorization are obtained. Do not replace the disabled scaffold with guessed endpoints or undocumented payloads.
