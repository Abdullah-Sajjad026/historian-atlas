# Deploy — Vercel + Neon runbook

Manual, copy-pasteable, in order. The agent/CI never runs any of this
against production — you do, from your machine.

## The two connection strings (read this first)

Neon gives every database TWO connection strings; this repo uses both,
for different things:

| Env var               | Neon string          | Host looks like                  | Used by                                   |
|-----------------------|----------------------|----------------------------------|-------------------------------------------|
| `DATABASE_URL`        | **Pooled**           | `ep-xxx-**pooler**.region.aws.neon.tech` | App runtime on Vercel (`src/db/client.ts`) |
| `DIRECT_DATABASE_URL` | **Direct** (unpooled)| `ep-xxx.region.aws.neon.tech`    | Migrations / seed / enrich (scripts only)  |

Why the split: each Vercel lambda opens its own connection, so the runtime
must go through Neon's PgBouncer pooler (the client also drops to `max: 1`
per instance when `VERCEL` is set — the pooler does the multiplexing).
Migrations are the opposite case: drizzle-kit takes advisory locks and runs
DDL, which assume one real session end-to-end — through a transaction
pooler that's unreliable. So `npm run deploy:bootstrap` **refuses to run**
without `DIRECT_DATABASE_URL`.

`drizzle.config.ts`, `scripts/seed.ts` and `scripts/enrich.ts` all prefer
`DIRECT_DATABASE_URL` and fall back to `DATABASE_URL` — locally you keep
setting just `DATABASE_URL` and nothing changes.

TLS: the client passes `ssl: "require"` whenever the URL contains
`sslmode=require` (Neon's strings do) or `DATABASE_SSL=true` is set.

Driver note: this is plain **postgres.js over the pooler** — sufficient at
this traffic. If connection errors ever show up at scale, the future option
is `@neondatabase/serverless` (HTTP/WebSocket driver); a deliberate
non-choice today, don't switch preemptively.

## 1. Create the Neon project

1. https://console.neon.tech → New project. Pick a region and REMEMBER it —
   you'll match Vercel to it in step 4 (e.g. Neon `aws-us-east-1` ↔ Vercel
   `iad1`, `aws-eu-central-1` ↔ `fra1`).
2. From the project dashboard, copy **both** connection strings:
   - "Pooled connection" (host contains `-pooler`) → this is `DATABASE_URL`
   - "Direct connection" → this is `DIRECT_DATABASE_URL`

   Both end in `?sslmode=require` — keep that suffix.

## 2. Schema + content, from your machine

```bash
DIRECT_DATABASE_URL='postgres://...@ep-xxx.<region>.aws.neon.tech/neondb?sslmode=require' \
  npm run deploy:bootstrap
```

That's `db:migrate` + `seed` (idempotent — safe to re-run after any content
edit). It fails loudly if `DIRECT_DATABASE_URL` is unset; never point it at
the pooled string.

## 3. Enrichment — THE TRUST-PASS ENTRY POINT

Needs egress to wikidata.org, so this runs from your machine, not CI:

```bash
DIRECT_DATABASE_URL='postgres://...direct...?sslmode=require' npm run enrich
```

Watch the output for `WARNING ... check the QID` lines — that's the
`labelLooksWrong` tripwire catching QID typos (wave-2 modules cordoba/mali/
song/carolingian/inca/habsburg-spain carry UNVERIFIED QIDs — see
docs/gotchas.md). For each warning:

1. Fix the QID in the relevant `content/spine/*` module.
2. `DIRECT_DATABASE_URL=... npm run seed` (re-upsert the corrected spine).
3. `DIRECT_DATABASE_URL=... npm run enrich -- <fixed-ids>` (re-fetch just those).

Repeat until a run reports `0 label warnings`.

## 4. Vercel

1. https://vercel.com/new → import the GitHub repo. Framework auto-detect
   (Next.js) is enough — there is deliberately **no vercel.json**.
2. Project → Settings → Functions → Region: pick the region matching Neon
   from step 1. Single region, Node runtime — no route opts into the edge
   runtime (verified: no `runtime` exports anywhere in `app/`), and the
   postgres driver needs Node. Keep it that way.
3. Environment variables: set **`DATABASE_URL` = the POOLED string** (with
   `-pooler` in the host and `?sslmode=require`) for Production. Do NOT set
   `DIRECT_DATABASE_URL` on Vercel — it's a scripts-only variable and
   nothing at runtime should use the direct string.
4. Deploy. The build needs no database (all pages are `force-dynamic`;
   `next build` only prerenders `_not-found`) — a build failure is never a
   missing-DB problem.

Notes:
- `output: "standalone"` in next.config.ts is for the Dockerfile; Vercel
  uses its own output format and ignores it — no conflict. (Not verified
  with a local `vercel build` — the CLI isn't installed here; if the first
  deploy fails in a weird way, that's the first thing to try locally.)
- No `images` config: enrichment images render via plain `<img>` from
  Wikimedia Commons (verified: zero `next/image` usage), so Next's image
  optimizer is not in play.

## 5. Smoke checklist

Against the prod domain, after steps 2–4 (every route is dynamic, so these
exercise the live DB through the pooler):

```bash
D=https://<your-domain>
curl -sf "$D/" | grep -qi historian                       && echo ok /
curl -sf "$D/world?year=800&view=both" -o /dev/null       && echo ok world
curl -sf "$D/world?year=802&links=1" -o /dev/null         && echo ok world+links
curl -sf "$D/timeline?lens=islamic-history" -o /dev/null  && echo ok timeline+lens
curl -sf "$D/periods/abbasid-caliphate" -o /dev/null      && echo ok period
curl -sf "$D/people/mansa-musa" -o /dev/null              && echo ok person
curl -sf "$D/events/siege-of-baghdad-1258" -o /dev/null   && echo ok event
# search payload present on the home page (root layout fetches the index):
curl -sf "$D/" | grep -q "abbasid-caliphate"              && echo ok search-index
```

And one eyeball check a curl can't do: open
`$D/periods/abbasid-caliphate` in a browser and confirm an enrichment
image renders (only populated after step 3; a broken image means enrich
didn't run or the Commons file name is wrong).

## Rollback

- **App**: Vercel → Deployments → previous deployment → "Instant Rollback".
  Stateless, safe, seconds.
- **DB**: all migrations so far are additive (new tables/columns/indexes,
  no destructive rewrites) — an older app build runs fine against a newer
  schema, so app rollback needs no DB rollback. If a future migration ever
  breaks that property, note it here and in the migration itself. Neon's
  branch/point-in-time restore is the escape hatch for data mistakes.

## Cost

Both free tiers suffice at MVP traffic: Neon free (0.5 GB storage, autosuspend
after inactivity — first request after idle pays a ~1s cold-resume) and Vercel
Hobby (100 GB-hrs functions). The seeded dataset is a few MB. Nothing here
needs a paid plan until real traffic says otherwise.
