# 2026-07-19 — Vercel + Neon deployment readiness

## Task

Make the app deployable to Vercel with Neon serverless Postgres: harden
the DB client for serverless, split pooled vs direct connection strings,
add a guarded prod bootstrap script, and write the manual runbook
(`docs/deploy.md`) so the deploy itself is a short human checklist.

Prerequisite check (prompt-chain guard): event pages merged — verified
`app/events/[id]/page.tsx` exists on main (PR #3, commit 16bb279).

## What changed

- `src/db/client.ts` — `ssl: "require"` when the URL contains
  `sslmode=require` or `DATABASE_SSL=true`; `max: 1` when `VERCEL` is set
  (else 5); `idle_timeout: 20`, `connect_timeout: 10`. All env reads
  runtime-only; driver stays postgres.js (no new deps).
- `drizzle.config.ts`, `scripts/seed.ts`, `scripts/enrich.ts` — prefer
  `DIRECT_DATABASE_URL` (Neon unpooled) over `DATABASE_URL`; enrich got
  its own script-local client so the shared runtime client stays
  pooled-only.
- `scripts/deploy-bootstrap.ts` + `npm run deploy:bootstrap` — migrate +
  seed, hard-requires `DIRECT_DATABASE_URL` (DDL/advisory locks through a
  transaction pooler are unreliable; no silent fallback to the pooled
  string).
- `docs/deploy.md` — NEW: the runbook (Neon setup, bootstrap, enrichment
  trust-pass, Vercel import, curl smoke checklist, rollback + cost notes).
- No `vercel.json` (framework auto-detect suffices; region choice
  documented instead). No `images` config (zero `next/image` usage —
  verified). No route opts into the edge runtime (verified — no `runtime`
  exports).
- `.github/workflows/ci.yml` — job-level comment: CI runs against its own
  throwaway postgres, never prod.
- `docs/architecture.md` (client env behavior section), `CLAUDE.md`
  (deploy:bootstrap command + deploy.md pointer).

## Verification

- `npm run typecheck` clean; 87/87 vitest tests pass.
- `next build` with BOTH db env vars explicitly unset → succeeds, every
  route `ƒ (Dynamic)` — build stays DB-free.
- Scratch check (deleted after use) importing the client:
  `VERCEL=1` + `sslmode=require` URL → `{max:1, ssl:"require",
  idle_timeout:20, connect_timeout:10}`; `DATABASE_SSL=true` alone → same;
  local default → `{max:5, ssl:false}`.
- `deploy:bootstrap` without `DIRECT_DATABASE_URL` → loud refusal, exit 1;
  WITH it (local pg 16, no `DATABASE_URL` set) → migrate + seed complete,
  time-slice smoke query passes — the exact prod path.
- Full smoke checklist (deploy.md §5) run against a local `next start` of
  the production build: all routes 200, search payload present.
  (Enrichment-image check needs Wikidata egress — user's step 3.)
- docker compose: daemon unavailable in this sandbox, so verified by
  inspection — compose sets only `DATABASE_URL` (no sslmode/VERCEL/
  DIRECT_DATABASE_URL/DATABASE_SSL), so the client resolves to the same
  `{max:5, ssl:false}` as before; seed's fallback keeps the migrate
  service unchanged.

## Decisions

- postgres.js over Neon's pooler, NOT `@neondatabase/serverless` — noted
  in deploy.md as the future option if connection errors appear at scale.
- `DIRECT_DATABASE_URL` is scripts-only and must not be set on Vercel;
  the runtime client never reads it.

## Follow-ups

- `output: "standalone"` vs Vercel build not verified with the Vercel CLI
  (not installed here) — expected fine (Vercel ignores it), flagged in
  deploy.md step 4.
- The enrichment trust-pass (deploy.md §3) is a manual step against real
  Wikidata — wave-2 QID warnings still outstanding until someone runs it.
