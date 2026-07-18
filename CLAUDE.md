# CLAUDE.md — historian

An immersive atlas of parallel history: a Postgres knowledge graph of
periods/people/events/themes rendered as entity pages, a zoomable
multi-lane Canvas timeline, and an interactive orthographic globe with a
year scrubber. Read `docs/` before non-trivial changes:

- `docs/architecture.md` — data model, query layer, the three shared renderers
- `docs/features.md` — every route and feature with implementation pointers
- `docs/content-guide.md` — how to author spine modules (the content format)
- `docs/gotchas.md` — landmines already stepped on; read before touching build/db/canvas
- `docs/workflow.md` — the preview-harness dev loop (how this repo verifies visuals)
- `docs/sessions/` — per-session work logs (history, not state). At the END
  of any session that changed the repo, append a `YYYY-MM-DD-<slug>.md`
  following the convention in `docs/sessions/README.md`.

## Commands

**Package manager: pnpm** (`pnpm-lock.yaml` is the lockfile — install with
`pnpm install`, never `npm install`). The scripts below work identically as
`pnpm run <script>` / `pnpm test`.

```bash
npm run dev            # next dev (needs DATABASE_URL; defaults to localhost:5433/historian)
npm test               # vitest — 59 tests, all pure-logic modules
npm run typecheck      # tsc --noEmit (TypeScript PINNED at 5.9 — see gotchas)
npm run bootstrap      # db:migrate + seed (idempotent; re-run after content edits)
npm run seed           # upsert content/spine/* into the DB
npm run enrich         # Wikidata enrichment — needs egress to wikidata.org
npm run db:generate    # drizzle-kit generate (after schema.ts changes)
npm run db:migrate     # apply migrations (includes registered custom SQL)
npm run build          # next build — requires NO database (all pages force-dynamic)

# Visual verification (see docs/workflow.md — use these after any canvas change):
DATABASE_URL=... npx tsx --tsconfig tsconfig.json scripts/render-preview.ts   # timeline PNGs -> /tmp
DATABASE_URL=... npx tsx --tsconfig tsconfig.json scripts/render-globe.ts     # globe PNGs -> /tmp

docker compose up --build   # full stack; app :3000, db on host :5433
```

## Invariants — do not break

1. **Years are astronomical integers** (1 BCE = 0, 2 BCE = -1). Calendar
   display (BCE/CE, Hijri) lives ONLY in `src/lib/dates.ts`. Never store
   calendar-specific values. `ONGOING = 3000` is the open-end sentinel.
2. **Curated beats enriched.** The `enrichment` JSONB (Wikidata) never
   overrides spine fields at render time. Enrichment is disposable.
3. **Themes are lenses, not categories.** Membership lives in
   `theme_memberships`; entities never store a theme. A lens SPOTLIGHTS
   (alpha), never hides, never resizes.
4. **Max 7 timeline lanes** (`REGIONS` in `src/db/schema.ts`). The taxonomy
   is geographic. Finer geography goes on entity metadata, never new lanes.
5. **`importance` 1–5 drives zoom LOD** (1 = visible fully zoomed out).
6. **Never fork draw code.** All canvas painting lives in shared modules
   (`src/lib/timeline-draw.ts`, `src/lib/globe-draw.ts`) used verbatim by
   both the browser clients and the node-canvas preview scripts. If you draw
   something new, put it in the shared module or the previews stop being
   true visual regressions.
7. **Pure logic in `src/lib`, thin shells in `app/`.** Geometry, LOD,
   fades, lens math, parsing — all pure, all unit-tested. Components own
   only DOM concerns (zoom transforms, DPR, pointer events, tooltips).

## Architecture in 30 seconds

Postgres stores four entities with generated `int4range` columns + GiST
indexes so the core query — "what existed in year T" — is an index scan
(`year_range @> T`). Content is typed TypeScript in `content/spine/*`,
upserted by an idempotent seed. Pages are Next 15 App Router server
components reading through `src/db/queries.ts` (pages never touch SQL).
Two canvases (timeline, globe) share the pigment token system defined in
`app/globals.css` — seven historical-pigment hues, one per region; color is
semantic (the lane system), there is no single brand accent.

## Working style expected in this repo

- Write/extend unit tests for any pure-logic change (`src/lib/*`).
- After ANY visual change: run the preview scripts, inspect the PNGs, and
  when in doubt pixel-audit (see `docs/workflow.md` — this loop has caught a
  real bug in every phase of this project).
- Content changes: edit `content/spine/*`, `npm run seed`, refresh — no
  rebuild needed (pages are dynamic).
- Migrations that Drizzle's DSL can't express (generated columns, GiST,
  self-FKs) go in a REGISTERED custom migration — see docs/gotchas.md for
  the exact procedure; getting this wrong silently desyncs the journal.
