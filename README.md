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

19 periods, 22 people, 19 events across all seven lanes, under three lenses
(islamic-history, silk-road, subcontinent).
Wave 3 added the atlas's first BCE content — the Maurya Empire (c. 322–184
BCE, all pre-CE years via `bce()`), Ashoka, and the Kalinga War — plus the
Delhi Sultanate (five dynasties as one period; a documented deepening seam)
and the Mughals (parentId → delhi-sultanate, the succession sealed by the
First Battle of Panipat linking both periods), Marco Polo's journey, and two
new lenses: The Silk Road (periods + Talas + Marco Polo, no people in v1)
and The Subcontinent (Maurya through the Mughals, Gupta and Aryabhata
included). Delhi/Mughal entities also joined the islamic-history lens, which
now spans four lanes. Wave 3 QIDs (ashoka, akbar, mughal-empire only —
others omitted rather than guessed) are best-effort pending an
`npm run enrich` tripwire pass.

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

## Wave 3 notes (content sprint — first BCE content, 2026-07)

Pure content + lens config: four new spine modules (maurya,
delhi-sultanate, mughal, silk-road-events), two new lenses, zero schema or
renderer changes. What the sprint proved and how it was verified:

- **BCE rendering works end to end, first time exercised against live
  data.** New permanent preview frames were added for it: timeline window
  `[bce(400), 100]` and a globe frame at `bce(250)`. The PNG shows axis
  ticks as "351 BCE … 1 BCE … 50 CE" (all through `formatYear`, no raw
  negatives), the Maurya bar and Kalinga lozenge at the correct pixels,
  and the globe frame shows the Pataliputra heartland with the Kalinga
  pulse mid-fade. One known nit, recorded in docs/features.md: d3 picks
  round *astronomical* ticks, so BCE labels read "301 BCE" not "300 BCE" —
  correct formatting, off-round selection; snapping is a future nicety.
- **Lens ghosting needed no new code.** A throwaway audit render (1600 CE,
  subcontinent lens) confirmed invariant 3 with the new lenses: Mughal at
  full pigment, Ottoman/Habsburg/Mali ghosted at unchanged size. A lens is
  purely membership rows flowing into an alpha decision.
- **LensPicker holds at three lenses.** Measured (node-canvas
  `measureText`, the decision-audit pattern) at 380px: exactly 2 lines
  with four pills — at the budget. Re-measure before adding a fourth lens.
- Verified green: typecheck, 59 tests, seed (19 periods / 22 people /
  19 events / 3 themes + smoke line), and all lens routes 200 with correct
  memberships in the served HTML.

## Wave 4 notes (people on the globe + faceted filtering, 2026-07)

The globe learned to show humans. People gained a place of principal
activity (`lat`/`lng`/`place`, one additive migration), a `?view=` toggle
(Empires | People | Both) renders them as four-point pigment stars through
the SHARED draw module, and a genre × civilization facet row
(`?genre=`, `?civ=`) narrows the people set — composing with `?lens=` and
`?modern=`. ~Doubled the people spine (22 → 45; 23 new, all with coords)
across ten modules. Highlights:

- **Facets FILTER, the lens DIMS.** The load-bearing asymmetry, documented
  in docs/features.md: a lens spotlights the world (nothing hidden), facets
  narrow the people query (stars AND Shining panel). The two systems never
  touch each other.
- **Coincident stars fan out.** Theodora, Basil II, and Anna Komnene all
  sit at 41.01, 28.98 — `fanOutCoincident` (pure, tested) spreads exact
  stacks into a small ring, applied per-frame to the alive set only.
- **Verified**: 67 tests green, typecheck, DB-free build; preview frames
  pixel-audited (star arms sample exact region pigment); the spec scenarios
  hold — scholars@1000 shows al-Zahrawi only (al-Ghazali unborn, Basil II
  a ruler), rulers@1000 inverts, and the faceted route serves
  "3 of 45 people" with Li Bai + Du Fu shining at 751 (Xuanzang †664
  appears when scrubbed earlier).
- **Patch (same day): every person is a star.** The 22 founding people got
  their coords (zero coordless people remain), and stars gained a
  lifecycle fade — `personFade` is `lifeFade` REUSED over the lifespan, so
  people kindle and dim exactly the way empires breathe (69 tests). The
  marquee frame: 800 CE, Charlemagne at Aachen and Harun al-Rashid's
  Baghdad court (al-Khwarizmi, a 14-year-old al-Ma'mun) on one hemisphere,
  Harun already dimming at fade 0.90, nine years from death.

## Decisions log

| Decision | Choice | Why |
|---|---|---|
| ORM | Drizzle | Raw-SQL escape hatch needed for generated ranges + GiST |
| Timeline rendering | Canvas + SVG overlay | Pure SVG degrades past ~2k nodes under zoom transforms |
| Graph storage | Postgres ranges, no graph DB | Time-slice is the hot query; GiST covers it natively |
| Hijri conversion | Year-level 33/32 approximation | Matches stored precision; day-level is out of scope |
| Ongoing periods | `end_year IS NULL`, sentinel 3000 in ranges | Keeps range math total without magic values in content |
| Delhi Sultanate `kind` | `kingdom`, not `era` | One sovereign state on one throne across five dynasties; `era` is for civilizational spans (Classic Maya), and the enum has no `sultanate` |
| Maurya → Gupta link | No `parentId` | ~500-year gap is shared heartland, not succession; `parentId` means "succeeded" |
| Mughal succession | `parentId` → delhi-sultanate | Real handoff: Panipat 1526 ends one and starts the other; the battle event links both periods |
| Silk Road lens people | Empty in v1 | Only people genuinely tied to the road qualify; none seeded yet — membership beats vibes |
| Wave 3 QIDs | ashoka/akbar/mughal-empire only | High-confidence only; omission beats guessing, enrich tripwire verifies later |
| People genres | `person_role` enum IS the genre system | No parallel taxonomy to drift; new genre = deliberate migration, nuance via multiple memberships |
| Lens vs facets | Lens dims, facets filter | A lens is a spotlight on the whole world; facets narrow the people query — collapsing them would lose one or the other semantics |
| Person coords | Place of principal activity, one point | Court/workshop/school, not birthplace, not itinerary; omit when no single place is honest (coordless people still list in the panel) |
| Silk Road lens people (v2) | Xuanzang, Marco Polo, Ibn Battuta | The road's actual travelers arrived with the people wave; court figures still don't qualify |
| Sundiata × islamic-history | NOT a member | Whether his Mali was yet meaningfully Islamic is a live scholarly debate; the lens claim starts with Mansa Musa |
| People-view labels | Stars labeled at imp ≤ 2, People view only | In Both, heartland serifs own the type layer; the Shining panel names everyone regardless |
