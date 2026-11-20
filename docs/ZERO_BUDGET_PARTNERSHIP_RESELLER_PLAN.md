# FICSDavid Zero-Budget Partnership + Authorized Reseller Plan

**Version:** 1.0  
**Starting budget:** TSh 0  
**Status:** Preparation and discovery only. This plan does not mean FICSDavid is registered, licensed, contracted or operating the listed services.

## Objective

Build the existing FICSDavid platform while securing compliant, written commercial routes to third-party services. Use partnership and authorized reseller/agent models according to each service. Do not spend money, accept customer funds or promise delivery before all relevant gates are passed.

## Route by service

| Service | Route to investigate | Required gate before live launch |
|---|---|---|
| Payments, collections and payouts | Partnership with an appropriately authorized provider | Written confirmation of FICSDavid's permitted role, merchant approval, regulatory review, settlement and refunds |
| Wallet / stored value | Licensed partner first | Written legal/regulatory confirmation; keep wallet inactive until approved |
| Data bundles / airtime | Authorized reseller/agent or platform partnership | Written resale authority, operator coverage, TCRA classification/licence if applicable, wholesale prices, float and reversals |
| SMS / OTP / USSD | Provider partnership; reseller only if expressly permitted | Sender ID, consent, data protection, TCRA and provider requirements |
| Voice / video | Technology partnership or compliant open-source architecture | Telecom classification, privacy/security, abuse controls and TURN/bandwidth cost |
| Search / images / news | Approved source/API partnership or permitted public APIs | Terms, attribution, copyright, privacy and usage limits |
| Search monetization | Publisher / affiliate partnership | Publisher acceptance, disclosure, payout threshold and tax treatment |
| AI services | Partnership or free sandbox/quota | No paid API usage until funded by realized revenue and usage limits are in place |
| Routers / network equipment | OEM/ODM partnership and authorized distribution | TCRA type approval, import/tax, warranty and operator authorization as applicable |

A provider's licence does not automatically transfer to FICSDavid. A reseller or referral label does not automatically remove FICSDavid's own regulatory obligations. Obtain written classification for the exact activity before launch.

## TSh 0 boundaries

Allowed:
- Maintain the platform and public provider register.
- Use local mock adapters and synthetic test data.
- Review public documentation and request information.
- Request free discovery calls and no-cost sandbox access.
- Prepare draft agreements, compliance questions, privacy notices and technical plans.
- Compare offers without accepting payment or promising delivery.

Not allowed:
- Buy credits, minimum float, deposits, devices or paid subscriptions.
- Promise free service where the upstream provider charges.
- Accept customer money for an unapproved service.
- Hold customer funds, operate an unapproved wallet or issue misleading receipts.
- Claim a provider is a partner, approved or live without evidence.
- Collect real customer personal data for a service before relevant data-protection requirements are met.

If a provider requires a deposit, paid onboarding or paid sandbox, mark it **blocked — funding required** and move to another candidate. Do not borrow or spend without a separate decision.

## 30-day work sequence

### Days 1–7: platform and preparation
- Keep Provider Integration Centre as the public source of truth.
- Show each provider's proposed route separately from its verified status.
- Prepare service-specific enquiries and due-diligence questions.
- Create synthetic test data and mock adapters only.

### Days 8–14: no-cost outreach
- Use official partner/contact channels to request partner packs and written requirements.
- Request free sandbox access, zero-minimum pilot terms and written commission schedules.
- Ask whether the provider accepts a platform partnership, authorized reseller, referral-only or agency model.
- Record an enquiry as sent only after it has actually been sent, with date and evidence.

### Days 15–21: evaluate
- Compare authorization, fees, minimum float, settlement, refunds, API security, data processing, SLA and termination terms.
- Reject unclear authority, hidden costs, forced deposits or unsupported claims.
- Ask relevant regulators for written classification where the activity may be regulated.

### Days 22–30: safe technical pilot
- Connect only a free sandbox or approved test environment.
- Use synthetic identities and test phone numbers.
- Test idempotency, webhook authentication, duplicate events, failures, refunds and reconciliation.
- Keep production switches off until all launch gates pass.

These are internal work targets, not promises that providers or regulators will respond within the period.

## Legal and compliance launch gates

Before a live service, determine and document:
1. BRELA registration and business structure appropriate to the activity.
2. TRA TIN, tax and business-licence obligations.
3. TCRA classification/licence for telecom, resale, messaging, USSD, numbering, voice, connectivity and equipment where applicable.
4. Bank of Tanzania requirements for payment system, payment service or wallet activities.
5. PDPC controller/processor registration and privacy obligations before personal-data processing.
6. Consumer terms, pricing, complaints, refunds, receipts and records.
7. Written provider authority and contract covering liability, SLA, security, data processing, settlement, reversals and trademark use.

Use official regulator channels and seek written answers. A general partner API agreement is not proof that every proposed activity is authorized.

## Revenue and founder-pay controls

Keep separate records for gross customer amount, provider cost/float, payment fees and taxes, refunds/reversals/chargebacks, settled commission/revenue share earned by FICSDavid, operating costs and reserves, and founder remuneration approved from available company earnings.

Only settled, contractually earned FICSDavid commission/revenue share is company revenue. Founder pay is considered only after tax, refunds, operating costs and agreed reserves. No monthly income is guaranteed before a service earns money.

## Provider status evidence

Use docs/provider-registry.json as the single source of truth. Lifecycle:

research → contacted → information_received → due_diligence → sandbox → contract_pending → approved → integrated → tested → live

Evidence required:
- contacted: date and sent enquiry record.
- information_received: provider response or partner pack.
- due_diligence: checked legal entity, authority, fees and terms.
- sandbox: written test access; credentials stored securely.
- contract_pending: draft/offer under review.
- approved: signed agreement and required regulatory approvals.
- integrated: code and secrets configured securely.
- tested: recorded success and failure-path test report.
- live: production approval, support/refund process and verified deployment.

Never place private contacts, contracts, credentials, API keys or customer information in the public repository. Store evidence in a controlled private location.

## First outreach order

1. Bundle/airtime aggregators: authorized reseller/agent terms with no minimum float and free sandbox.
2. SMS/OTP providers: partnership terms, free test access and sender-ID requirements.
3. Payment providers: platform/merchant partnership model and written permitted scope; no live wallet.
4. Search monetization: affiliate/publisher programs with no upfront spend.
5. AI and voice/video: defer paid usage; investigate free/open-source options and full operating costs.

## Decision rule

Choose the option with the clearest written authority, lowest fixed cost, no compulsory deposit, safe API, fair net commission and workable refunds. If none meets these conditions at TSh 0, keep the service in research and continue building the core platform.
