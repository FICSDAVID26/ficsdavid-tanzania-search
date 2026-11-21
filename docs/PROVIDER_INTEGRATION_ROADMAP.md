# FICSDavid Provider Integration Roadmap

**Status:** Planning and partner discovery only. No provider is contracted or connected by this document.
**Starting budget:** TSh 0. Build documentation, adapters, test doubles and partner requests before paying for accounts, credits, licenses or hardware.

## 1. Integration principles

1. Keep one FICSDavid platform, one master identity and shared authorization.
2. Put every provider connection behind a server-side adapter. Browser code must never call a provider with private credentials.
3. Use provider-neutral internal contracts so providers can be changed without rewriting customer-facing services.
4. Default every provider to `research` or `disabled`. Never show a service as live until contract, credentials, security review, end-to-end tests and operational support are complete.
5. Never treat customer funds, wallet balances, pending transactions or provider float as FICSDavid revenue.
6. Keep an auditable record of provider, external reference, internal idempotency key, amount, fee, status, timestamps and reconciliation outcome. Do not log passwords, API keys, PINs, OTPs or raw payment credentials.
7. Preserve founder ownership and least-privilege administrative access.

## 2. Service portfolio and dependency order

| FICSDavid service | Provider capability needed | Revenue hypothesis | Current gate |
|---|---|---|---|
| Tanzania Search (web, images, video, news, education) | Search/content APIs; optional ad or affiliate programs | Approved advertising or disclosed referral commission | Review provider terms, attribution, privacy and content rights |
| Data Bundles | Authorized Tanzania bundle reseller/aggregator API | Contracted reseller margin/commission | Obtain operator coverage, wholesale price list, delivery API, refunds and reseller agreement |
| Airtime | Airtime top-up API | Contracted margin/commission | Confirm networks, minimum float, settlement and failed-top-up reversal |
| Payments / checkout | Licensed/authorized payment aggregator | Usually a cost of collecting customer payments, not automatic revenue | KYC, merchant approval, fees, settlement, refunds, webhook verification |
| Wallet | Regulated wallet/payment partner and legal review | Only permitted fees under approved model | Keep inactive; no custody or customer balances until legal approval |
| SMS / OTP / WhatsApp | Approved messaging provider and sender identity | Business messaging revenue only after commercial approval | Consent, sender ID, opt-out, templates, data protection and pricing |
| Calls / video calls | WebRTC infrastructure, TURN and/or licensed voice provider | Subscription or business usage plans | Privacy/security design, abuse controls, telecom/regulatory review |
| Messages | Secure messaging infrastructure | Possible premium/business plans | End-to-end encryption, key lifecycle, abuse reporting and independent review |
| Contacts | FICSDavid-owned encrypted service | Supporting platform capability | Owner-only access, encryption keys, retention and deletion tests |
| Help Centre / support | Ticketing/email/WhatsApp support provider | Usually retention/support, not direct revenue | Data minimization, access controls and response process |
| AI Assistant | AI model/API provider | Metered usage, subscriptions or business plans | Cost limits, safety, data terms, privacy and user disclosure |
| Number services | Authorized operator/numbering/USSD/SMS partners | Contracted service margin | TCRA/operator approvals, numbering rights and service-specific license review |
| FICSDavid Networks | Hardware OEM/ODM, connectivity and distribution partners | Device sales, managed connectivity and support | Device certification, LTE bands, import duties, warranty and ISP/TCRA approvals |

## 3. First partner shortlist (not endorsements)

### Payments
- **MALIPOPAY** — Tanzania payment API documentation describes collections across mobile money, CRDB/NMB, USSD and cards, plus disbursements. Its current documentation says API access is dashboard-issued and go-live approval is required. Published fees are provider fees and must be reconfirmed in a written merchant offer. Documentation: https://developers.malipopay.co.tz/
- **Selcom** — developer documentation describes payment and disbursement APIs; its developer portal directs merchants to contact its team for access to certain services. Request commercial onboarding, sandbox, supported products and fees. Documentation: https://developers.selcommobile.com/ and https://developer.selcom.business/

### Messaging, OTP and airtime
- **Beem Africa** — public API materials list SMS, two-way SMS, USSD, airtime, OTP, WhatsApp and mobile payments. Request Tanzania coverage, reseller terms, sandbox and written pricing. https://beem.africa/beem-api/
- **DARSMS** — public Tanzania materials describe SMS API, delivery reports, sender IDs and OTP use. Public pricing and trial terms may change; confirm current fees, VAT, sender ID approval and commercial use directly. https://www.darsms.co.tz/ and https://dev.darsms.co.tz/

### Data bundles and search monetization
- No bundle aggregator or search monetization partner is approved by this roadmap. Source at least two candidates and verify that each has written authorization for resale/referrals in Tanzania, live product catalogue, price/commission schedule, order status API, refunds and support contacts before choosing one.
- Search advertising/affiliate integrations must be disclosed, respect provider policies and not distort organic ranking.

## 4. Common server-side provider contract

Each adapter should expose the relevant subset of these internal operations:

- `healthCheck()`: verify provider availability without exposing secrets.
- `getCapabilities()`: return supported countries, networks, products, currencies and limits.
- `quote(request)`: return a time-limited provider quote with source timestamp and fees.
- `createOrder(request, idempotencyKey)`: create a pending request only after server-side validation and payment authorization.
- `getStatus(externalReference)`: retrieve authoritative provider status.
- `verifyWebhook(request)`: authenticate signatures/timestamps and reject replayed events.
- `refundOrReverse(reference, reason)`: only where the provider contract supports it.
- `reconcile(period)`: compare FICSDavid records with provider statements.

Never invent a successful status. An HTTP 200 response alone is not proof that a bundle, airtime or payment has completed. Use explicit provider status mapping and reconciliation.

## 5. Transaction lifecycle and revenue separation

Recommended state machine:

`draft → quoted → awaiting_payment → payment_confirmed → submitted_to_provider → processing → fulfilled`

Exceptional states:

`expired`, `failed`, `reversal_pending`, `reversed`, `refund_pending`, `refunded`, `manual_review`.

Rules:
- Generate a unique internal order ID and idempotency key on the server.
- Recalculate price and verify quote expiry immediately before charging.
- Never fulfil on a browser callback; verify payment server-to-server or by authenticated webhook.
- Deduplicate webhook event IDs and make handlers replay-safe.
- Reconcile provider and payment records daily before recording realized commission.
- Show customer a clear pending state if provider status is unknown; do not retry non-idempotent actions blindly.
- Record gross customer amount, provider cost, payment fee, tax, refund/reversal and net earned commission separately.
- Transfer only settled, realized company earnings into the equipment reserve under the approved accounting process.

## 6. Security, privacy and compliance gates

- Secrets only in Cloudflare server-side secrets; never in HTML, JavaScript bundles, Git, logs or chat.
- Keep existing `RESEND_API_KEY` secret name and value untouched.
- Use HMAC/signature verification, timestamp tolerance, replay protection, rate limits and strict schema validation.
- Encrypt sensitive personal data at rest and in transit; minimize collection and retention.
- Keep Wallet inactive until Tanzanian legal/regulatory advice confirms the permitted model and required approvals. Use a licensed partner where appropriate; do not imply that a payment gateway alone authorizes FICSDavid to operate a wallet.
- Review TCRA requirements for telecom, messaging, numbering, VAS, spectrum, devices and ISP operations as applicable. Obtain type approval for hardware before import/sale where required.
- Obtain TRA, data protection, consumer protection and tax advice relevant to the final business model.

- **Personal data:** PDPC states that a person must be registered as a data controller or data processor before collecting or processing personal data. Confirm FICSDavid's role(s), registration route, DPO requirements and applicable fees before opening user registration or processing customer information. Official guidance: https://pdpc.go.tz/services/registration/
- **Telecom/application services:** TCRA's licensing guidance describes application services as including resale of electronic communication services to end users, and the EPOCA framework provides for licensing of application, network and content services. Do not assume that using an aggregator removes FICSDavid's own licensing obligations; obtain written TCRA classification for the exact proposed model before offering bundles, airtime, SMS/USSD, hosted voice, numbering or connectivity. Official sources: https://www.tcra.go.tz/resources/telecommunications-ict and https://www.tcra.go.tz/uploads/documents/sw-1628847969-Guidelines%20for%20Application%20of%20Individual%20Licence.pdf
- **Value-added services:** review the TCRA Value Added Services Regulations, including consumer opt-in/activation, opt-out/deactivation and advertising obligations where applicable: https://tcra.go.tz/sw/laws-and-guidelines/regulations/the-electronic-and-postal-communications-value-added-services-regulations-2018-2
- **Payments and Wallet:** obtain written confirmation from the payment partner and Tanzanian legal/regulatory advice on whether FICSDavid is acting only as a merchant using a licensed provider or conducting a separately regulated payment/wallet activity. A gateway API is not itself a license for FICSDavid.
- Require written partner contracts covering authorization, service levels, fees, settlement, liability, customer complaints, refunds, data processing, security incidents, termination and use of trademarks.

### Identity verification — Tanzania NIDA

- NIDA's official data-sharing guidance describes partner access through a formal application to the Director General, with institutional/business licensing documents, TIN, network architecture and API details; the submission is assessed before technical consultation, agreement and test access.
- NIDA lists Common Interface Gateway (CIG), Secure Portal and offline card verification routes. FICSDavid must not call a private or unofficial endpoint, scrape NIDA records, or claim an identity is NIDA-verified without authorized access and a successful, auditable response.
- NIDA lists usage charges; therefore this is not a live TSh 0 integration. Keep the provider in research/disabled state until the required legal/business and data-protection prerequisites, written approval, fees and security tests are complete.
- Email/SMS OTP verifies control of a contact channel only. It must never be represented as legal identity verification or NIDA KYC.
- Official information: https://nida.go.tz/index.php/Ushirikishanaji-Taarifa and https://services.nida.go.tz/default

## 7. TSh 0 execution plan

### Stage A — no-cost preparation
- Keep provider catalogue as research-only metadata.
- Send partnership enquiries and request free sandbox/test access.
- Build mock adapters and automated tests using fake responses.
- Document each provider's requirements, pricing and onboarding status.
- Do not buy SMS credits, provider float, hardware or paid hosting for this stage.

### Stage B — first commercial pilot
- Select one approved bundle/airtime provider and one payment provider after written offers.
- Complete merchant KYC and contracts.
- Test sandbox or provider test recipients; no real customer money.
- Run controlled internal tests and reconciliation.

### Stage C — limited live pilot
- Launch only after approval, security review, support/refund process, accurate customer terms and a successful end-to-end test.
- Start with strict transaction limits and manual monitoring.
- Track actual net margin, failure rate, refund time and support cost.

### Stage D — expand
- Add second providers for resilience and better wholesale rates.
- Add SMS/OTP and other communication services.
- Add search monetization, AI and Network hardware partnerships only when their unit economics and compliance gates are met.

## 8. Provider due-diligence checklist

Before signing or coding a live adapter, obtain:
- Legal company name, registration details, physical address and authorized signatory.
- Written proof of authority to distribute each product in Tanzania.
- API documentation, sandbox access, test credentials and webhook signing specification.
- Full price list, commission/margin, taxes, minimum float, setup/monthly fees and settlement cycle.
- Supported networks, product denominations, coverage and uptime history.
- Order lifecycle, idempotency support, rate limits, retries and reconciliation reports.
- Refund/reversal rules, SLA, escalation contacts and incident process.
- Data processing terms, data location/retention and security certifications.
- Contract term, exclusivity, termination, liability and dispute resolution.
- Permission to advertise the provider relationship and use its brand.

## 9. Partner onboarding status

Use `docs/provider-registry.json` as the source of truth. A provider moves through:
`research → contacted → information_received → due_diligence → sandbox → contract_pending → approved → integrated → tested → live`.

A status change requires evidence (email/contract, approved dashboard, test report or deployment verification). A provider appearing in the registry does not mean a partnership exists.
