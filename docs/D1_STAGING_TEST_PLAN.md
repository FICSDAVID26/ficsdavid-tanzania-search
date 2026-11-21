# Cloudflare D1 staging test plan

## Purpose
Validate account-verification rate-limit migrations and D1 behavior against a separate staging database, without touching production.

Production database: `ficsdavid-main` (binding `DB`).
Staging database name: `ficsdavid-staging`.

## Non-negotiable safety rules
1. Never run staging commands against `ficsdavid-main`.
2. Use synthetic test accounts and verification codes only; never copy production data.
3. Do not change, display, paste, or rotate the existing `RESEND_API_KEY`.
4. Keep live email, payments, Wallet, SMS, provider integrations, and regulated services disabled.
5. Do not run destructive D1 commands or write queries against production.
6. Do not edit the production `wrangler.toml` binding for this test.
7. Stop if the staging database UUID and Preview binding cannot be positively verified.

## 1. Create a separate D1 database
From an authorized Cloudflare account session:

```sh
npx wrangler d1 create ficsdavid-staging
```

Record the newly returned staging UUID privately. Do not commit it to this repository or paste it into chat. Do not use `--update-config`.

## 2. Make a local-only staging config
Create `wrangler.staging.toml` locally and do not commit it:

```toml
name = "ficsdavid-staging-check"
compatibility_date = "2026-11-13"

[[d1_databases]]
binding = "DB"
database_name = "ficsdavid-staging"
database_id = "THE_NEW_STAGING_DATABASE_UUID"
migrations_dir = "migrations"
```

Before proceeding, verify that the database name is exactly `ficsdavid-staging` and that the UUID is the newly created staging UUID, not the production UUID.

## 3. Review and apply migrations to staging
List pending migrations:

```sh
npx wrangler d1 migrations list ficsdavid-staging --remote --config wrangler.staging.toml
```

Review every SQL migration in `migrations/`. Then apply only to staging:

```sh
npx wrangler d1 migrations apply ficsdavid-staging --remote --config wrangler.staging.toml
```

Confirm Wrangler output names `ficsdavid-staging` and shows the staging UUID. Stop if either differs. List migrations again to confirm the result:

```sh
npx wrangler d1 migrations list ficsdavid-staging --remote --config wrangler.staging.toml
```

## 4. Separate Pages Preview binding — required before runtime tests
A real remote D1 runtime/concurrency test requires a non-production Cloudflare Pages Preview deployment whose `DB` binding points to `ficsdavid-staging`.

In Cloudflare Pages project settings, configure the **Preview** environment's D1 binding `DB` to the staging database only. Do not change the Production environment's binding. Verify the Preview binding's database name and UUID in the dashboard before running any API test.

Do not assume a branch preview is safe until its binding is verified. If Preview cannot be configured independently, stop remote runtime tests and rely on the existing Node.js/SQLite-compatible CI tests until a safe staging environment exists.

## 5. Synthetic-data test checklist
- Verification requests are rate-limited as intended.
- Simultaneous requests cannot exceed the configured limit.
- A verification code/state transition can be consumed only once.
- Duplicate requests/retries do not create duplicate successful transitions.
- Expired and invalid codes are rejected.
- Database errors fail safely without bypassing rate limits.
- Logs and responses do not expose verification codes, secrets, or personal data.

Record only the CI run ID, commit SHA, staging database name, migration result, and pass/fail outcomes. Never record credentials or customer data.

## Completion gate
Staging is approved only after the staging UUID is confirmed distinct from production, migrations succeed, Preview binding is verified, and remote D1 runtime/concurrency checks pass. Until then, keep PR #1 and #2 unmerged and do not deploy to Production.

## Official references
- https://developers.cloudflare.com/workers/wrangler/commands/d1/
- https://developers.cloudflare.com/d1/get-started/
