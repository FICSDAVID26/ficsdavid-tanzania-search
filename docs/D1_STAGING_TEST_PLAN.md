# Cloudflare D1 staging test plan

## Purpose

Validate the account verification rate-limit migrations and D1 behavior against a **separate staging D1 database**, without reading from, writing to, or changing the production database.

Production D1 database:
- Name: `ficsdavid-main`
- Binding in the current project: `DB`

Staging database name:
- `ficsdavid-staging`

The staging database must have its own Cloudflare D1 database ID. Never copy the production database ID into staging configuration.

## Safety rules

1. Do not run staging test commands against `ficsdavid-main`.
2. Do not use production data in staging. Use synthetic test accounts and test verification codes only.
3. Do not change, print, paste, or rotate `RESEND_API_KEY` for this test.
4. Do not enable live email, payment, wallet, SMS, provider, or other regulated integrations as part of this test.
5. Do not run `wrangler d1 delete`, `wrangler d1 execute` with write statements, or migrations against production.
6. Do not change the existing `wrangler.toml` production binding for this test.
7. If the staging database ID or the Cloudflare Pages preview binding cannot be positively verified, stop.

## Phase 1 — Create a separate D1 database

Using an authorized Cloudflare account session and Wrangler CLI:

```sh
npx wrangler d1 create ficsdavid-staging
```

This creates a new remote D1 database. Record the returned **staging** database UUID privately in the local staging config only. Do not post it in chat or commit it to a public repository.

Do not add `--update-config`; the production config must remain unchanged.

## Phase 2 — Create a local-only staging config

Create a local file named `wrangler.staging.toml`. Do not commit it. Add the staging database UUID returned in Phase 1:

```toml
name = "ficsdavid-staging-check"
compatibility_date = "2026-11-13"

[[d1_databases]]
binding = "DB"
database_name = "ficsdavid-staging"
database_id = "PASTE_THE_NEW_STAGING_DATABASE_UUID_HERE"
migrations_dir = "migrations"
```

Before any remote command, manually verify all three values:
- `database_name = "ficsdavid-staging"`
- `database_id` is the newly returned staging UUID, not the production UUID
- `migrations_dir = "migrations"`

Keep this local file out of Git. Never put secrets in it.

## Phase 3 — Review and apply migrations to staging only

First list pending migrations:

```sh
npx wrangler d1 migrations list ficsdavid-staging --remote --config wrangler.staging.toml
```

Review the migration files in `migrations/` before applying. Then apply to staging only:

```sh
npx wrangler d1 migrations apply ficsdavid-staging --remote --config wrangler.staging.toml
```

Confirm the Wrangler output names `ficsdavid-staging` and shows the staging database UUID. If the name or UUID differs, cancel/stop and investigate.

List migrations again to confirm they are applied:

```sh
npx wrangler d1 migrations list ficsdavid-staging --remote --config wrangler.staging.toml
```

## Phase 4 — Staging runtime binding (separate approval gate)

A real D1 runtime/concurrency test requires a non-production Pages preview deployment whose `DB` binding points to `ficsdavid-staging`.

In Cloudflare Pages project settings, configure the **Preview** environment's D1 binding `DB` to the staging database only. Leave the Production environment's existing `DB` binding untouched. Verify the Preview binding's database name and UUID in the dashboard before testing.

Do not deploy to Production. Do not assume a branch preview is safe until its D1 binding has been checked.

If the preview environment cannot be configured independently from Production, do not perform remote runtime tests. Keep using the existing Node.js and SQLite-compatible CI tests until a safe staging environment is available.

## Phase 5 — Test checklist

Use synthetic data only. Verify:
- account verification requests are rate-limited as intended;
- simultaneous requests cannot exceed the configured limit;
- a verification code/state transition can be consumed only once;
- retries and duplicate requests do not create duplicate successful transitions;
- expired and invalid codes are rejected;
- database errors fail safely without bypassing rate limits;
- logs and API responses do not expose verification codes, secrets, or personal data.

Record the test run ID, commit SHA, staging database name, migration results, and pass/fail outcomes. Do not record credentials or customer data.

## Completion criteria

The staging gate is complete only when:
- the staging D1 UUID is confirmed distinct from production;
- migrations apply successfully to staging;
- the Pages Preview `DB` binding is confirmed to point to staging;
- the D1 runtime/concurrency checks pass;
- Production configuration and data remain unchanged.

Until all criteria pass, keep PR #1 and PR #2 unmerged and do not deploy these changes to Production.

## Official Cloudflare references

- D1 Wrangler commands: https://developers.cloudflare.com/workers/wrangler/commands/d1/
- D1 getting started: https://developers.cloudflare.com/d1/get-started/
