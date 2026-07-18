# historian

An immersive, visual atlas of human history: parallel timelines of dynasties and
empires, influential people per era, theme lenses (Islamic history, Chinese
dynasties, ...), and a time-slice view answering *"what was happening everywhere
in year T?"* — the question the Meanwhile rails answer.

> Working title. Rename freely; nothing depends on it.

**Working on this repo with an agent (Claude Code etc.)?** Start at
`CLAUDE.md`, then `docs/` — architecture, features, content authoring,
gotchas, and the preview-harness workflow are all documented there at
full session-context depth.

## Architecture in one paragraph

The app is a queryable spatiotemporal knowledge graph. Postgres stores four
entities — **periods**, **people**, **events**, **themes** — with all years as
astronomical integers (`src/lib/dates.ts`). Generated `int4range` columns +
GiST indexes make the time-slice query an index scan. Content lives as typed
TypeScript files in `content/spine/` (curated by hand, reviewed in PRs) and is
upserted by an idempotent seed script. Every entity carries a `wikidata_qid`;
a Phase 4 script enriches entities from Wikidata into a quarantined JSONB
column that curated fields always override.

## Invariants (do not break)

1. **Years are astronomical integers.** 1 BCE = 0, 2 BCE = -1. Calendar
   concerns (BCE/CE labels, Hijri) live only in the display layer.
2. **Curated beats enriched.** At render time, spine fields win over the
   `enrichment` JSONB. Enrichment is disposable.
3. **Themes are lenses, not categories.** A theme selects a subgraph via
   `theme_memberships`; entities never store a theme.
4. **Max 7 timeline lanes** (`REGIONS` in `src/db/schema.ts`). Finer geography
   goes on entity metadata, never new lanes.
5. **`importance` (1–5) drives zoom LOD.** 1 = visible fully zoomed out.

## Run it with Docker (recommended first run)

```bash
docker compose up --build
# app on http://localhost:3000 once migrations + seed complete
# (db exposed on host port 5433 to avoid clashing with a local postgres)
```

The image ships Next's **standalone output** — verified by running
`.next/standalone/server.js` directly against a live DB. Build needs no
database (all pages are force-dynamic). The `migrate` compose service uses
the `tools` image stage (dev deps kept for drizzle-kit/tsx) and runs
`npm run bootstrap` (= db:migrate + seed) before the app starts. Enrichment
is still a manual step: `docker compose run --rm migrate npm run enrich`.

CI (`.github/workflows/ci.yml`) runs typecheck, unit tests, then
migrate + seed + build against a pgvector service container — the seed's
time-slice smoke query doubles as a schema integration test.

## Manual setup

```bash
npm install
# Postgres — reuse an existing container or:
# docker run -d --name historian-pg -e POSTGRES_PASSWORD=docker -p 5432:5432 pgvector/pgvector:pg16
createdb historian   # or via psql

export DATABASE_URL=postgres://postgres:docker@localhost:5432/historian
npm run db:migrate   # applies 0000 (drizzle-kit) + 0001 (custom range SQL)
npm run seed         # upserts content/spine/*, prints a time-slice smoke test
npm test             # date utility tests
npm run typecheck
```

`drizzle/0001_ranges.sql` is a **registered custom migration** (it's in
`drizzle/meta/_journal.json`) containing the generated range columns, GiST
indexes, and the periods self-FK — things Drizzle's DSL can't express. If you
regenerate migrations from scratch, recreate the slot with
`npx drizzle-kit generate --custom --name=ranges` and re-paste its SQL.

## The core query

```sql
-- "The world in 800 CE" — index scan, O(log n)
SELECT * FROM periods WHERE year_range @> 800 ORDER BY importance;
```

Verified: `EXPLAIN` shows `Index Scan using periods_slice_idx`.

## Adding content

1. Create `content/spine/<civilization>.ts` exporting a `SpineModule`
   (see `content/spine/types.ts` for the contract, `abbasid.ts` for a worked
   example including a succession stub and a cross-period event).
2. Register it in `content/spine/index.ts`.
3. `npm run seed` — upserts are idempotent; re-running after edits is normal.

Use `bce()`/`ce()` helpers for pre-CE years so intent survives code review.
Summaries stay at 1–3 sentences; narrative prose belongs in MDX pages (Phase 1).

## Roadmap

- [x] **Phase 0** — schema, date utilities, seed pipeline, Abbasid vertical slice
- [x] **Phase 1** — Next.js shell, entity pages (period/person/theme), the
      Meanwhile rail, Tang module; grow spine toward ~12 civilizations
- [x] **Phase 2** — parallel timeline at `/timeline`: d3 zoom + Canvas lane
      renderer, importance-based LOD, pointer hit-testing (no SVG overlay —
      see Phase 2 notes)
- [x] **Phase 3** — the globe at `/world`: orthographic d3-geo canvas globe,
      year scrubber + play mode, spheres of influence with birth/death fade,
      event pulses, heartland click-through
- [x] **Phase 4** — Wikidata enrichment: `npm run enrich` (EntityData JSON ->
      enrichment JSONB), fixture-tested parser, QID-typo tripwire, display
      merge on period pages
- [x] **Phase 6** — depth: people threads on the timeline at human-scale
      zoom, header search, Habsburg Spain + the first cross-hemisphere event
      edge; ship-readiness: standalone output, Dockerfile + compose, CI,
      per-entity metadata
- [x] **Phase 5** — lens as a view mode: `?lens=<theme>` on /timeline and
      /world ghosts non-members (alpha only, never size), lens picker pills,
      theme pages link into both lensed views

## Phase 1 notes

Run the app: `npm run dev` (needs `DATABASE_URL`; pages are `force-dynamic`,
so edit spine -> `npm run seed` -> refresh, no rebuild).

Design tokens live in `app/globals.css`: vellum/ink ground, and one
historical-pigment hue per region (`--color-mena` = lapis, `--color-east-asia`
= cinnabar, ...). Region color is semantic — it is the lane system the Phase 2
timeline will draw. Display type is a system old-style-serif stack; swap in a
webfont later without touching components.

Signature element: the **Meanwhile rail** on every entity page. Two variants:
`ConcurrentRail` (period pages — concurrency by *range overlap*, because a
midpoint sample misses real overlaps: Abbasids' midpoint is 1004 CE, after
Tang and before the Mongols despite 157 shared years with the Tang) and
`MeanwhileRail` (person pages — point sample at mid-life, fine for lifespans).
Period rails exclude events already listed on the page.

Pinned `typescript@5.9`: TS 7 (the Go compiler) removed `baseUrl`, which
Next 15's path-alias resolution still expects.

## Phase 6 — depth

**People on the timeline.** Zoom past ~2.5 px/year (`PEOPLE_MIN_PX_PER_YEAR`)
and lifespans appear as thin pigment threads in a strip beneath each lane's
period bars — packed into rows like periods, LOD-gated by importance, birth
marked with a solid tick, labels collision-aware via the same `labelSpace`
mechanism, hit-testable and click-through to person pages. A person's lane is
borrowed from their earliest period membership (`getTimelinePeople`). All
layout math is pure and tested; paint verified by pixel-sampling the preview
render at every computed thread position (5/5 in-window painted, Harun
al-Rashid sampling as pure lapis at his birth tick).

**Search.** Header search box over the full entity index (client-side filter
— the spine is curated, small by design; revisit past a few thousand
entries). Arrow keys + Enter; events land on the timeline until they get
pages.

**Habsburg Spain** closes the Cajamarca link: the first cross-HEMISPHERE
event edge (Americas lane <-> Europe lane).

## Scale hardening (timeline at 15+ periods)

The timeline draw is now `src/lib/timeline-draw.ts`, shared verbatim by the
client and the preview script (same pattern as globe-draw — no more mirrored
code anywhere). Two features landed with it, both decided in the layout
module and unit-tested: **draw culling** (`isBoxVisible`, 200px margin so
outside labels can bleed in) and **collision-aware labels** — each PeriodBox
carries `labelSpace`, the pixel gap to the next bar in its row; a beside-the-
bar label renders only if it fits, otherwise it's skipped and the tooltip
reveals the name. Verified with a placement audit at two zooms: Rashidun's
label (20px bar) correctly skips at full zoom and switches to beside when
zoomed in.

## Phase 2 notes

All timeline geometry lives in `src/lib/timeline-layout.ts` as pure, tested
functions (lane packing via greedy interval coloring, LOD thresholds in
px/year, point hit-testing). `app/timeline/timeline-client.tsx` is a thin
Canvas shell: d3-zoom transform, devicePixelRatio scaling, tooltip, click ->
router.push. Only `d3-scale`/`d3-zoom`/`d3-selection` are installed, not all
of d3.

**Plan deviation:** no SVG overlay for hit targets. The layout boxes are
already in memory, so the pointer is hit-tested against the same geometry the
canvas painted — one source of truth, nothing to keep in sync. Revisit only
if per-element accessibility on the canvas becomes a requirement (the data is
also available as text on the home page, noted in the canvas aria-label).

**LOD contract:** px-per-year thresholds in `lodMaxImportance` decide which
`importance` ranks render; events gate one rank stricter than periods. Canvas
height grows/shrinks as rows appear.

`scripts/render-preview.ts` renders the timeline to PNG with node-canvas
using the real layout module + live DB — visual regression checking without a
browser. Its draw code mirrors the client's; change both together. It caught
one real bug already: labels anchored at `bar.x` vanish off-canvas when a
long period's left edge is panned out of view — labels now clamp to the
visible viewport.

## Phase 3 notes (the globe)

`/world` renders an antique-style orthographic globe: drag to rotate, wheel
to zoom, scrub or play the year. Civilizations render as translucent pigment
**spheres of influence** around a heartland (`center_lat`/`center_lng`/
`influence_km` on `periods`) — deliberately not precise borders, since
per-year historical boundary data is a licensing problem (GeaCron-scale).
Events carry `lat`/`lng` and flare as expanding rings for ±15 years around
their date. Circles swell in over a period's first decade and dissolve over
its last (`lifeFade`), so play mode shows empires breathing rather than
popping.

All painting is `src/lib/globe-draw.ts`, one function shared **verbatim** by
the browser client and `scripts/render-globe.ts` (node-canvas 2D contexts are
API-compatible) — an improvement over Phase 2's mirrored draw code; the
preview PNGs are now true visual regressions of the shipped renderer. Pure
year math (activeAt, pulses, fade, km->degrees) lives in `src/lib/globe.ts`
with tests. Coastlines come from `world-atlas` land-110m TopoJSON, bundled
client-side (~100 KB raw, gzips small).

## Phase 4 notes (enrichment)

`npm run enrich` fetches https://www.wikidata.org/wiki/Special:EntityData/{QID}.json
for every entity with a `wikidata_qid` (EntityData, not SPARQL — plain JSON,
no query-service quirks), parses it with the pure, fixture-tested
`src/lib/enrich.ts`, and writes ONLY the `enrichment` JSONB + `enriched_at`.
Flags: `--stale` re-fetches rows older than 30 days; positional args enrich
specific ids. It runs sequentially with a delay and a descriptive User-Agent
per Wikimedia etiquette. **Run it from your own machine** — it needs egress
to wikidata.org.

Safety rails: curated fields always win at render (invariant 2); the script
compares Wikidata's label against the curated name and prints a WARNING on
mismatch — that's the QID-typo tripwire (a few best-effort QIDs in
content/spine/world.ts are expected to trip it on first run; fix and rerun).
Period pages render `enrichment.imageFile` via Commons Special:FilePath with
an attribution caption; everything else is fallback-only.

## Content status

15 periods, 16 people, 14 events across all seven lanes.
Wave 2 added: Umayyads of Córdoba (EUROPE lane, child of umayyad-caliphate —
the succession chain and the Islamic lens now both cross lanes), Mali (Mansa
Musa's hajj flares in the MENA lane), Song (parentId bridges the Five
Dynasties gap to Tang), Carolingians, and the Inca (Cajamarca awaits a
habsburg-spain module to link against). Wave 2 QIDs are best-effort pending
an `npm run enrich` tripwire pass.

Wave 1 covered (originally 10 periods, 11 people, 9 events): the full
caliphate succession chain Rashidun -> Umayyad -> Abbasid plus the Ottomans
(Islamic lens now spans 622–1922 with the Hijra as a deliberately period-less
event), Tang, Mongols, Byzantium, Gupta, Ghana, and the Classic Maya. The
Fall of Constantinople links Byzantine + Ottoman across lanes and modules.

## Phase 5 notes (the lens as a view mode)

`/timeline?lens=islamic-history` and `/world?lens=islamic-history` spotlight
the lens subgraph: members render full strength, everything else ghosts to
low alpha — dimmed context, never hidden, because "what else was happening"
is the product thesis. Two rules learned by pixel-sampling the preview:
the lens changes **alpha only, never radius** (a ghosted empire keeps its
true size), and ghost strokes keep a legible floor (~0.3) so outlines stay
readable as context. An unknown lens id degrades gracefully to the unlensed
view. `getThemeEntityIds` in the query layer returns the subgraph; the pure
`lensAlpha` helper in src/lib/globe.ts is shared by both canvases.

## Decisions log

| Decision | Choice | Why |
|---|---|---|
| ORM | Drizzle | Raw-SQL escape hatch needed for generated ranges + GiST |
| Timeline rendering | Canvas + SVG overlay | Pure SVG degrades past ~2k nodes under zoom transforms |
| Graph storage | Postgres ranges, no graph DB | Time-slice is the hot query; GiST covers it natively |
| Hijri conversion | Year-level 33/32 approximation | Matches stored precision; day-level is out of scope |
| Ongoing periods | `end_year IS NULL`, sentinel 3000 in ranges | Keeps range math total without magic values in content |
