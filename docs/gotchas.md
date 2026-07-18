# Gotchas — landmines already stepped on

Every entry here cost real debugging time. Read before touching the
relevant area.

## Toolchain

### TypeScript is PINNED at 5.9 — do not upgrade casually
A bare `npm i -D typescript` pulls **TypeScript 7** (the Go-native
compiler), which **removed `baseUrl`** — and Next 15's webpack path-alias
resolution still needs it. Symptoms: `tsc` errors "Option 'baseUrl' has
been removed", or Next build failing with `Can't resolve '@/db/queries'`.
Keep `typescript@5.9` until Next supports tsgo aliasing.

### drizzle-kit custom migrations BLANK the file
`npx drizzle-kit generate --custom --name=X` registers the slot in
`drizzle/meta/_journal.json` **and overwrites the target .sql with an empty
placeholder** — even if a file with that name already has content. Correct
procedure for hand-written SQL:
1. `drizzle-kit generate --custom --name=X` (creates + registers empty slot)
2. THEN write your SQL into `drizzle/000N_X.sql`
3. `npm run db:migrate`
Never hand-create a .sql in drizzle/ without journal registration — migrate
silently ignores it.

### Generated columns vs drizzle-kit generate
`schema.ts` declares `year_range`/`life_range` via a customType so reads
are typed — but drizzle-kit emits them as PLAIN int4range columns in its
generated DDL. The custom migration (0001_ranges.sql) therefore does
`DROP COLUMN IF EXISTS` then re-adds as `GENERATED ALWAYS ... STORED`
(safe: generated columns carry no independent data). If you ever regenerate
migrations from scratch, recreate the custom slot and re-paste that SQL.

### drizzle-kit migrate swallows errors
It prints a spinner and exits 1 with no message. To see the real error, run
the programmatic migrator: import `migrate` from
`drizzle-orm/postgres-js/migrator` in a scratch script and catch/print.
(This is how we found a silent auth failure — see next item.)

### psql multi-statement `-c` is one transaction
`psql -c "ALTER USER ...; CREATE DATABASE ..."` — if the second statement
fails (CREATE DATABASE can't run in a transaction block), the FIRST rolls
back too. We lost a password ALTER this way and got mysterious
"password authentication failed" from an apparently-set password. Run
statements separately.

## Build & runtime

### `next build` needs NO database — keep it that way
All pages are `force-dynamic`; the build only prerenders `_not-found`.
Verified by building with Postgres stopped. This is what keeps the
Dockerfile builder stage dependency-free. If you add `generateStaticParams`
or remove force-dynamic anywhere, you re-introduce a build-time DB
dependency — decide deliberately.

### Standalone output needs static assets copied
`output: "standalone"` produces `.next/standalone/server.js` with a pruned
node_modules, but `.next/static` (and `public/` if it existed) must be
copied in alongside: `cp -r .next/static .next/standalone/.next/static`.
The Dockerfile runner stage does this; if you run standalone locally,
do it yourself or CSS/JS 404s.

### Stale dev/prod servers serve stale builds
`next start` binds a port and keeps serving the OLD build after you
rebuild; a second `next start` on the same port fails silently and your
curl hits the zombie. When "my change isn't showing": kill ALL next
processes, confirm the port is actually free, then start.

## Canvas & visualization

### Labels anchored at bar.x vanish off-canvas
When a long period's left edge is panned off-screen, a label drawn at
`bar.x + 8` has negative x. Clamp: `visX = max(bar.x, 0)`, and compute the
VISIBLE width for the fits-inside decision. (First bug the preview harness
caught — "Tang Dynasty" disappeared at zoom.)

### Lens ghosting: alpha ONLY, never size — and floors matter
First implementation multiplied lensAlpha into lifeFade → ghosted globe
circles SHRANK (wrong: the lens dims, it doesn't rewrite geography), and
0.15 × the already-low 0.26 fill alpha made ghosts invisible (pixel-
sampling showed ghosted-circle pixels identical to bare land). Fix:
lifeFade drives radius+alpha; lensAlpha drives alpha only; ghosted fills
get a 0.35 multiplier and strokes a ~0.3 floor.

### Midpoint sampling is wrong for period concurrency
A period's "meanwhile" must be a RANGE-OVERLAP query, not a sample at the
midpoint year. Abbasids (750–1258): midpoint 1004 falls after Tang (†907)
and before the Mongols (1206) → empty rail despite 157 shared Tang years.
Point sampling stays correct for people (lifespans are short).

### d3-geo back-hemisphere points still project
`projection([lng, lat])` returns coordinates for points on the FAR side of
an orthographic globe (clipAngle only clips paths). Front-hemisphere test:
project a tiny `geoCircle` at the point and check `geoPath.area(...) > 0`.
Without this, labels/markers render for invisible heartlands.

### node-canvas specifics
- Install is fine here (prebuilt binaries via GitHub releases).
- Its 2D context is API-compatible incl. `roundRect` — cast
  `as unknown as CanvasRenderingContext2D` and reuse the shared draw
  modules verbatim.
- It lacks the display serif; previews inject
  `fonts: { label: "13px Georgia", ... }` — Georgia's metrics are close
  enough for label-fit decisions.

## Data & content

### Seed module ORDER matters (cross-module FKs)
`periods.parent_id` is a real FK (added in 0001). Modules are seeded in
`content/spine/index.ts` array order inside one transaction, with a
two-pass parent update PER MODULE — so cross-MODULE parents require the
parent's module earlier in the array. Current constraints:
`islamicBookends` before `abbasid` (umayyad → rashidun);
`habsburgSpain` before `inca` (cajamarca links against it).

### Wave-2 QIDs are UNVERIFIED
Modules cordoba/mali/song/carolingian/inca/habsburg-spain carry best-effort
Wikidata QIDs. The enrichment script's `labelLooksWrong` tripwire WARNs on
mismatch — run `npm run enrich` (needs wikidata.org egress), fix flagged
QIDs in the spine, re-seed, re-enrich.

### Events with zero periods are legal
The Hijra (622) predates every period in the atlas; `periodIds: []` is a
supported, deliberately-exercised edge case. Don't "fix" it.

### ONGOING sentinel is 3000
`end_year IS NULL` means ongoing; the generated ranges COALESCE to 3000
(`ONGOING` in src/lib/dates.ts). Any range math must use the same sentinel.

### Hijri conversion is year-level ±1 approximation
The 33/32 formula, deliberately. Matches stored precision; day-level
(Umm al-Qura) is out of scope. All AH output is labeled and approximate.

## Environment quirks (dev containers / CI)

- Compose exposes the db on host **5433** to avoid clashing with an
  existing local postgres on 5432. In-network the app still uses db:5432.
- `pkill -f next` inside a chained shell command kills the chain's own
  process group — run kills as their own step, verify ports free
  (`ss -tlnp`), then start servers with `setsid ... &` so they survive.
- Playwright's browser CDN may be unreachable in sandboxed envs — the
  node-canvas preview harness exists precisely so visual verification
  never depends on a browser.
