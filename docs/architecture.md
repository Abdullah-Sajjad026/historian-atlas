# Architecture

## The one-paragraph model

This app is a queryable spatiotemporal knowledge graph. Four entities —
**periods** (dynasties/empires/caliphates), **people**, **events**,
**themes** — live in Postgres. Every temporal fact is an astronomical-year
integer with a generated `int4range` + GiST index, making time-slice and
overlap queries index scans. Everything visual (timeline lanes, globe
circles, lens ghosting) is a projection of this graph.

## Database (`src/db/schema.ts` + `drizzle/`)

- **periods**: slug PK, kind enum, `start_year`/`end_year` (NULL = ongoing),
  per-endpoint `date_certainty` enums, `region` (lane key), `parent_id`
  self-FK (succession chains — can cross lanes, e.g. umayyads-of-cordoba in
  EUROPE descends from umayyad-caliphate in MENA), `importance` smallint,
  heartland columns `center_lat`/`center_lng`/`influence_km` (globe),
  `wikidata_qid`, `enrichment` JSONB + `enriched_at`.
- **people**: birth/death + certainties, `influence` (one-liner: why they
  matter), `lat`/`lng`/`place` (place of principal activity — the globe's
  People-view star; nullable), same enrichment columns. Region is NOT
  stored — the timeline and globe borrow it from the earliest period
  membership (see `getTimelinePeople` / `getGlobePeople`).
- **events**: point or range, `lat`/`lng` (globe pulse), linked to 0..n
  periods via `event_periods` (0 is legal — see the Hijra).
- **themes** + `theme_memberships` (polymorphic: entity_type + entity_id;
  FK enforced in app layer by seed construction, not the DB).
- **links**: connections drawn as great-circle arcs on the globe. `kind`
  enum (embassy/war/trade/journey/transmission); endpoints A and B are
  each EITHER an entity ref (`a_type` + `a_id`) OR a literal place
  (`a_lat`/`a_lng`/`a_label`) — the XOR is enforced by the spine types and
  the seed's lint pass, NOT the DB (entity ids deliberately aren't FKs so
  links can cross content modules in any seed order; a dangling id fails
  the seed loudly instead). `start_year`/`end_year` (NULL = point link),
  `certainty`, `importance`, `summary`, `group_id` (journey hops share
  one), `wikidata_qid`.
- Join table `period_people` carries a `role` enum (ruler/scholar/...).

### Generated columns & indexes (drizzle/0001_ranges.sql)

`year_range`/`life_range` are `GENERATED ALWAYS AS (int4range(start,
COALESCE(end, 3000), '[]')) STORED` with GiST indexes. These live in a
**registered custom migration** because Drizzle's DSL can't express them —
`schema.ts` declares them via a customType for read typing only. The
periods self-FK also lives there (DSL self-reference causes a TS inference
cycle). `EXPLAIN` confirms `Index Scan using periods_slice_idx` for
`year_range @> $1`.

### Key queries (`src/db/queries.ts`) — pages never touch SQL

- `getTimeSlice(year, excludePeriodId?)` — the core primitive: periods alive
  at T (`@>`) + events within ±25y. Used by person pages ("In their
  lifetime" rail).
- `getPeriodDetail(id)` — entity + parent/successors + people-with-roles +
  events + **concurrent** periods/events by RANGE OVERLAP (`&&`), NOT a
  midpoint sample. Rationale: the Abbasids' midpoint is 1004 CE — after
  Tang, before the Mongols — despite 157 shared Tang years; a point sample
  renders an empty rail. Rule: **point queries for people (short lifespans),
  overlap queries for periods.** Concurrent events exclude ones already
  linked to the period (NOT EXISTS on event_periods).
- `getEventDetail(id)` — event (+ enrichment + lat/lng) + participant
  periods via event_periods (0 is legal — the Hijra) + links touching the
  event as an endpoint (other-endpoint names resolved so the page can link
  entities; dangling ids fall back to the slug) + `moment`: the event-year
  slice via `getTimeSlice` (an event is a MOMENT, so the point-sample rule
  applies, not period-style range overlap) with the event itself filtered
  out of the ±25y events window — the same self-exclusion the period rail
  does.
- `getThemeEntityIds(id)` — the lens subgraph (period + event + person id
  lists).
- `getTimelinePeople()` — `DISTINCT ON (person)` joined through
  period_people to borrow the earliest membership's region.
- `getGlobePeople()` — one row per person with memberships AGGREGATED
  (`array_agg(DISTINCT role)`, `array_agg(DISTINCT period_id)`) for the
  People-view facets, region still borrowed from the earliest period.
  The `::text` cast on the role agg matters: postgres.js parses `text[]`
  natively but not arrays of custom enums.
- `getGlobeLinks()` — all links rows; callers resolve endpoints against the
  entity rows they already loaded (`resolveEndpoints`) and skip
  unresolvables.
- `getSearchIndex()` — flat name index for the header search.

## Rendering: three canvases, zero forked draw code

Pattern (arrived at iteratively; Phase 2 mirrored draw code and it bit us —
see gotchas): **pure layout math → shared paint function → thin client**.

| Surface  | Pure math (tested)            | Shared paint             | Thin shells                                            |
|----------|-------------------------------|--------------------------|--------------------------------------------------------|
| Timeline | `src/lib/timeline-layout.ts`  | `src/lib/timeline-draw.ts` | `app/timeline/timeline-client.tsx`, `scripts/render-preview.ts` |
| Globe    | `src/lib/globe.ts`            | `src/lib/globe-draw.ts`  | `app/world/globe-client.tsx`, `scripts/render-globe.ts` |

node-canvas 2D contexts are API-compatible with the browser's, so the
preview scripts execute the SHIPPED paint code against live DB data —
the PNGs they emit are true visual regressions.

### Timeline layout (`timeline-layout.ts`)

- `buildLanes(periods)`: group by region in fixed REGIONS order; within a
  lane, greedy first-fit interval packing into sub-rows (inclusive-range
  overlap mirrors int4range '[]' — Umayyad 661-750 and Abbasid 750-1258
  SHARE year 750, so they split rows). Empty regions produce no lane
  (deliberate while the spine is small; revisit ~12 civs).
- `lodMaxImportance(pxPerYear)`: zoom → max visible importance rank.
  Events gate one rank stricter than periods.
- `layoutTimeline(lanes, events, xOf, pxPerYear, people)`: emits pixel
  boxes. Each `PeriodBox`/`PersonBox` carries `labelSpace` — the pixel gap
  to the next bar in its row — which the draw uses to skip
  beside-the-bar labels that would overprint (tooltip still reveals).
- **People strip**: gated at `PEOPLE_MIN_PX_PER_YEAR = 2.5`; lifespans pack
  into thin rows below the period rows; lane height grows accordingly
  ("empires from a distance, humans up close").
- `hitTest(layout, x, y)`: events > people > periods priority.
- `isBoxVisible(box, width, margin=200)`: draw culling; margin lets outside
  labels bleed in from just off-screen.

### Timeline paint (`timeline-draw.ts`)

Axis ticks, lane labels, bars with a three-way label decision
(inside-clamped-to-viewport / beside-if-labelSpace-fits / skipped),
person threads (55% alpha bar + solid birth tick), event lozenges
(45°-rotated squares), lens ghosting at `GHOST = 0.15` via globalAlpha.
Fonts injectable (node-canvas lacks the display serif; previews pass
Georgia, which measures close enough for label decisions).

### Globe (`globe.ts` + `globe-draw.ts`)

- Pure: `activeAt`, `mappablePeriods` (alive + has heartland, big-radius
  first for painter's order), `kmToDegrees` (÷111.32 for d3.geoCircle),
  `pulseIntensity` (±15y linear falloff), `lifeFade` (0.08-floor ramp over
  first/last 10y — "empires breathe"), `lensAlpha` (1 or GHOST_ALPHA 0.15).
  URL-state helpers (also pure/tested): `clampYear` (parse-and-clamp for
  `?year=`; absent/NaN → null so callers keep their default), `clampCoord`
  (the same contract for `?lat=`/`?lng=` — keeps the fraction, clamps into
  ±bound; event pages enter through these since events have no `?focus=`
  slug) and `rotationForPoint(lat, lng)` → `[-lng, -clamp(lat, ±MAX_PHI)]`,
  the orthographic rotation centering a point (`?focus=` resolves a
  period's heartland through it server-side and wins over `?lat=&lng=`;
  MAX_PHI = 80 is the same pole bound the drag clamps to).
  `src/lib/modern-borders.ts` (also pure/tested): `selectCountryLabels` —
  geoArea threshold + allowlist over countries-110m features, geoCentroid
  positions — feeding the optional modern-borders overlay.
  Connections (also pure/tested): `resolveEndpoints` (entity ref →
  heartland/place/event coords, literal passthrough; null if either side
  can't resolve — callers skip, never crash; deliberately ignores endpoint
  lifetimes), `linkAlpha` (range links REUSE lifeFade over
  {start_year, end_year}; point links reuse pulseIntensity with a tighter
  ±8y window — pulseIntensity gained an optional `window` param, no fork),
  `linkLensAlpha` (max of lensAlpha over ENTITY endpoints; literal
  endpoints contribute GHOST; alpha only, like every lens effect).
- Paint: d3-geo orthographic + geoPath(ctx). Order: ground shadow →
  lit sphere (radial gradient, upper-left light) → graticule → land
  (world-atlas land-110m TopoJSON, bundled) → modern borders if enabled
  (dashed hairline, under the pigments) → influence circles
  (halo + core + stroke) → modern country labels if enabled (uppercase
  mono, receding) → connection arcs if `showConnections` (default true) —
  geoPath over a two-point LineString (d3 interpolates the great circle,
  clipAngle clips the far side), ink-soft stroke at
  linkAlpha × linkLensAlpha, dash by kind, 2.5px endpoint dots + mono
  labels for literal endpoints, `DrawResult.arcs` metadata (no
  hit-testing v1) — → heartland dots + halo-stroked serif labels, deferred
  to a final pass so they top both the fills and the modern labels
  (front-hemisphere test via a tiny geoCircle's projected area, because
  projection() returns coords even for back-hemisphere points — shared
  `onFront` helper) → event pulse rings (radius grows as intensity fades)
  → person stars last (`GlobeFrame.view` = periods | people | both:
  periods-only skips stars, people-only skips circles+heartlands; stars are
  four-point pigment shapes with a bright core via `starPeople` — alive-set
  fan-out + importance-descending painter's order — alpha = `personFade`
  (the lifeFade ramp mapped over the lifespan; people kindle and dim) ×
  the lens dim through `lensPersonIds`, facet-filtered UPSTREAM by
  `filterPeople`; DrawResult returns `stars` beside `heartlands` for
  hit-testing).
- `GlobeFrame.modern?: ModernOverlay` = `{ enabled, borders, labels }`:
  border geometry is a topojson interior-borders mesh, labels come from
  `selectCountryLabels`, both computed once at module scope by the two
  shells. The overlay is constant — never multiplied by `lifeFade` or
  `lensAlpha` (it's the fixed reference grid; only the history ghosts).
- **Critical separation**: `lifeFade` drives radius AND alpha; `lensAlpha`
  drives alpha ONLY (a ghosted empire keeps its true size), with a ~0.3
  stroke floor so ghost outlines stay legible.
- Client owns rotation drag (manual pointer math, φ clamped ±MAX_PHI), wheel
  zoom (0.8–2.6), the year scrubber + play mode (rAF, 14 yr/s), heartland
  click-through (hit radius 10px on DrawResult.heartlands), the side
  panel (alive-at-year + flaring events, lens-ghosted at 40% opacity), and
  the year write-back: scrub/pause → 400ms debounce → `router.replace` of
  `?year=` built from the live search string (all other params preserved);
  never during play, and rotation drag never writes (`?focus=` is an entry
  hint, not tracked state). No year store/context — the URL and the one
  `year` state are the only homes.

## App shell

- Next 15 App Router, everything `force-dynamic` (edit content → seed →
  refresh; no rebuild). Root layout is dynamic too (search index fetch).
- Tailwind v4 via @tailwindcss/postcss; tokens in `app/globals.css` @theme:
  vellum/ink ground, `--color-<region>` pigments (lapis=mena,
  cinnabar=east-asia, verdigris=europe, indian-yellow=south-asia,
  ochre=africa, cochineal=americas, celadon=steppe). Canvas reads them via
  getComputedStyle at mount — one color source.
- Type: system old-style serif display stack (Iowan Old Style/Palatino/
  Georgia), mono for ALL years/dates (`.year`), letter-spaced mono eyebrows.
- Shared components in `app/components.tsx`: RegionTick (rotated lozenge),
  PeriodYears (certainty-aware, optional dual Hijri), MeanwhileRail
  (point-sample variant, person + event pages) and ConcurrentRail (overlap
  variant, period pages), REGION_LABEL map.

## Enrichment (`src/lib/enrich.ts` + `scripts/enrich.ts`)

EntityData JSON endpoint (NOT SPARQL — plain JSON, cacheable, no query-
service quirks): `wikidata.org/wiki/Special:EntityData/{QID}.json`.
Pure `parseEntity` (fixture-tested; tolerates redirects + missing fields)
→ payload {label, description, imageFile(P18), enwiki, fetchedAt} written
to `enrichment` JSONB only. `labelLooksWrong` compares Wikidata's label to
the curated name — the QID-typo tripwire (script WARNs). Sequential fetch,
350ms delay, descriptive User-Agent (Wikimedia etiquette). Flags: `--stale`
(>30d), positional ids. Display: period pages render `imageFile` via
Commons `Special:FilePath/<file>?width=` with attribution caption.

## Deployment

`output: "standalone"` in next.config.ts. Dockerfile stages:
deps → builder → **tools** (dev deps kept; compose `migrate` service runs
`npm run bootstrap` here) → runner (pruned standalone, non-root).
Compose: pgvector db on host **5433** (avoid local-pg clash) → migrate
(gated on db health) → app (gated on migrate completion). CI mirrors the
same pipeline against a pgvector service container; the seed's time-slice
smoke query doubles as the schema integration test.
