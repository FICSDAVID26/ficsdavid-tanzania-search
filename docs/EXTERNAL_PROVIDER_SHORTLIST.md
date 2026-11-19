# FICSDavid External Provider Shortlist

**Research date:** 2026-11-19  
**Status:** Candidate shortlist only. No provider account, contract, API credential or production integration is confirmed.

## Recommended first contacts

| FICSDavid capability | Candidate | Evidence in public documentation | Next onboarding checks |
|---|---|---|---|
| Email verification | Existing Resend integration | Existing application code already uses the encrypted `RESEND_API_KEY` binding for email verification. | Verify sender domain/from address and test delivery. Never expose the secret. |
| SMS / OTP | Beem | Beem documents a local SMS OTP workflow, approved templates/Sender ID and API credentials. https://beem.africa/knowledge-base/how-to-integrate-and-use-otp-api-on-local-sms-account/ and https://docs.beem.africa/ | Ask about Tanzania delivery coverage, Sender ID approval, OTP pricing, throughput, delivery receipts, sandbox and merchant onboarding. |
| SMS / OTP alternative | Africa's Talking | Official help documentation describes account/app setup, Sender ID or shortcode requirements and sandbox. https://help.africastalking.com/en/articles/2258472-how-do-i-start-sending-messages | Confirm Tanzania routes, OTP availability, sender approval, rates and local support. |
| SMS / OTP alternative | eHub SMS | Public API docs describe send-SMS and OTP send/verify endpoints. https://sms.ehub.co.tz/api-docs | Verify operator coverage, company identity, pricing, sender-ID approval, data processing and support SLA. |
| Mobile Money collections / checkout | Selcom | Developer documentation describes checkout, mobile-money pull payments, cards and related payment APIs; some services require contacting Selcom. https://developers.selcommobile.com/ | Request merchant onboarding, supported channels, fees, settlement timing, refunds, sandbox, webhook signing and regulatory/contract requirements. |
| Mobile Money collections / payouts | PayIn | Public API docs list Tanzania M-Pesa, Airtel Money, Tigo Pesa/Yas and Halo Pesa collections and payouts with webhooks. https://docs.payin.co.tz/ | Independently verify company/legal entity, Bank of Tanzania status/partner arrangements, settlement account, fees, limits, refunds, support and live references before selection. |
| Mobile Money checkout alternative | PayIt | Official docs describe merchant API, mobile-money initiation, payment polling and signed webhooks. https://payit.co.tz/docs | Verify supported networks, merchant eligibility, fees, settlement, sandbox, security and regulatory status. |
| Airtime / bundle distribution | Sema | Public product page advertises a Tanzania airtime API and coverage across network operators. https://sema.co.tz/airtime-recharge/ | Ask whether API supports data bundles (not only airtime), exact MNOs, catalogue/quote/order/status endpoints, reversals, float funding, SLA and reseller authorization. |
| Voice/video calling | Agora | Official RTC SDK docs cover web and mobile voice/video calling and channel/token flows. https://docs.agora.io/en/realtime-media/rtc/get-started-sdk/web | Compare Tanzania call quality, regional routing, pricing, token server, data residency, privacy, recording controls and bandwidth performance. |
| Voice/video alternative | Twilio Video | Official docs describe WebRTC video rooms, SDKs, server-generated access tokens, signaling and media infrastructure. https://www.twilio.com/docs/video/overview | Confirm product availability, regional quality, pricing, account eligibility and current product lifecycle before choosing. |

## Important distinction: wallet vs payment gateway

A payment gateway can collect or disburse money for an approved merchant. That does **not** automatically authorize FICSDavid to operate a stored-value wallet, hold customer funds, issue e-money or provide regulated payment services. Wallet functionality must remain a non-custodial ledger/sandbox foundation until legal, licensing, safeguarding, partner and reconciliation requirements are confirmed with the relevant authorities and regulated partners.

## Provider due-diligence checklist

Before writing a production adapter or accepting credentials, obtain and verify:

1. Registered legal entity, physical/business contacts and applicable licences or regulated-partner arrangement.
2. Signed merchant/reseller agreement and written authorization for each product (especially data bundles).
3. Current API documentation, sandbox credentials, test numbers and support contact.
4. Fees, minimum float/deposit, settlement schedule, transaction limits, reversals/refunds and chargeback rules.
5. Authentication model, webhook signature verification, idempotency guarantees, rate limits and incident process.
6. Data protection terms, retention, cross-border processing, security controls and breach notification.
7. Successful sandbox tests and a small controlled live pilot approved by the project owner.

Never send API secrets in chat, commit them to Git, or place them in browser JavaScript. Store approved credentials only in encrypted Cloudflare server-side secrets. Do not share the existing `RESEND_API_KEY` value.

## Implementation order

1. Confirm the existing Resend email path with a controlled test.
2. Select one SMS/OTP provider after commercial and technical checks; build one adapter and retain a provider-neutral interface.
3. Select one payment aggregator for merchant checkout; start in sandbox and never call a payment successful based only on a browser redirect.
4. Select an airtime/data-bundle supplier only after it confirms data-bundle catalogue and delivery API rights.
5. Prototype Agora vs Twilio for calls/video using test accounts and measured network quality.
6. Keep messaging, wallet and all provider-dependent features marked **Integration pending** until end-to-end tests prove otherwise.

## Research limitations

Public API documentation proves that an integration interface is documented; it does not prove the provider has approved FICSDavid, that the service is licensed for the intended use, that Tanzania routes are currently enabled, or that commercial terms are acceptable. This shortlist is not an endorsement or legal/compliance opinion.
