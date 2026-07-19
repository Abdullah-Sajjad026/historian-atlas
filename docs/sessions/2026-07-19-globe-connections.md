# 2026-07-19 — Connections: great-circle arcs on the globe

## Task

Relationships between entities (embassy/war/trade/journey/transmission)
stored as a `links` table, seeded from the spine, and drawn as
great-circle arcs on the globe — alive during their years, dimmed by the
lens, listed in the side panel. The Harun ↔ Charlemagne embassy becomes a
drawn line between their stars.

**Prerequisite guard passed** (per the new "Prompt chains" section this
session added to docs/workflow.md): people-on-globe foundation +
coordinate patch verified present in b35f9c3 — `people.lat/lng/place` in
schema, stars rendered with `personFade` (lifeFade reuse), marquee frame
at 800 (`globe-800-people.png`) in render-globe.ts, all confirmed in the
artifacts before any work began.

## What changed

- **Schema** (`drizzle/0004_links.sql`, plain drizzle-kit generate — 0001
  untouched): `links` table + `link_kind` / `link_endpoint_type` enums.
  Endpoints are (type+id) XOR (lat+lng+label) per side — enforced by spine
  types + seed lint, NOT the DB (refs deliberately aren't FKs, so links
  cross modules in any seed order).
- **Spine format** (`content/spine/types.ts`): `SpineLink` /
  `SpineLinkEndpoint` (discriminated union makes the XOR structural),
  `SpineModule.links?`.
- **Content** (`content/spine/connections.ts`): all 9 spec links — the
  embassy, Talas, 1453, Saharan gold, Indian numerals (year outside
  Gupta's lifetime — legal, commented), Xuanzang→Nalanda, and the three
  `ibn-battuta-travels` hops (delhi-sultanate + ibn-battuta existed, so
  hops included). One module: nearly every link crosses modules.
- **Seed** (`scripts/seed.ts`): `lintLinks` runs BEFORE the transaction —
  XOR violations and dangling refs throw (exit 1, verified with a scratch
  broken ref, then removed); resolvable-but-coordless endpoints WARN only.
  Links upsert after all entities. Counts gain `connections: 9`.
- **Pure logic** (`src/lib/globe.ts`, +9 tests → 78): `resolveEndpoints`
  (heartland/place/event coords; null → skip, never crash; ignores
  endpoint lifetimes on purpose), `linkAlpha` (range = lifeFade REUSED;
  point = pulseIntensity with a new optional `window` param at ±8y — a
  parameter, not a fork), `linkLensAlpha` (max lensAlpha over ENTITY
  endpoints, literals contribute GHOST, missing set = empty not no-lens).
- **Shared draw** (`src/lib/globe-draw.ts`): `GlobeFrame.links` +
  `showConnections` (default true). Arcs stroke after influence circles,
  before the deferred serif labels/pulses/stars (type layer and stars stay
  on top). geoPath over a two-point LineString — d3 interpolates the great
  circle, clipAngle clips the far side. Dash by kind (war solid, embassy
  [6,4], trade [10,6], journey [2,4], transmission [12,3,3,3]), dash reset
  immediately + save/restore (new gotchas.md entry), +0.8px width at
  importance 1, 2.5px endpoint dots, mono labels on literal endpoints
  (front-hemisphere gated). `DrawResult.arcs` metadata; NO hit-testing —
  open decision #6 in features.md.
- **UI** (`app/world/*`): `getGlobeLinks` query; page resolves endpoints
  server-side; "Connections" checkbox by the view toggle; `?links=0`
  disables (absent = on), composing with view/lens/modern/facets; side
  panel "Connections" section (mono kind glyph, summary first clause,
  mono years, 40% lens ghost; journey hops collapse per `group_id` to the
  most-alive hop, showing its endpoints). Facets do NOT filter arcs —
  asymmetry documented beside the lens-vs-facet note.
- **Docs**: features.md (connections + open decisions #6 arc hit-testing,
  #7 event-page hubs), architecture.md (links table, queries, pure fns,
  paint order), content-guide.md (authoring links), gotchas.md (setLineDash
  leak), workflow.md (**new "Prompt chains" section**: halt on missing
  prerequisites, do not reconstruct), test counts refreshed.

## Verification

- 78 tests green (embassy peaks at 802 / gone by 816; trade ramps at 905,
  full at 950; unresolvable-skip; lens multiplier incl. literal-GHOST);
  typecheck clean; DB-free `next build` clean.
- Seed lint scratch test: dangling `atlantis-empire` ref → "Link lint
  failed", exit 1, before any write; scratch removed; clean re-seed:
  19/45/19 + 9 connections.
- render-globe frames (shared draw, pixel-audited per workflow.md):
  - **802, [-25,-40]**: embassy arc Aachen↔Baghdad dashed between the lit
    Charlemagne and Baghdad-cluster stars, alpha 0.50 (the range peak);
    19/41 samples along the great circle ink-dark vs bare-land lum 229.
  - **1453**: zero-length war arc (both ends Constantinople) degrades to
    the two endpoint dots under the heartland marker — no stroke streak
    (butt caps on a zero-length path); observed behavior commented in the
    frame list.
  - **960 + islamic lens**: saharan-gold arc at 1.00 (21/41 dark), Talas
    long gone; control sampling of the same geo-path on a dead-link frame:
    1/41. NOTE, honest deviation from the spec's parenthetical:
    ghana-empire is NOT an islamic-history member (only Córdoba is) — the
    arc is full via the max rule, which the frame proves anyway.
  - SSR: `/world` → `initialLinks:true`, `?links=0` → false (arc pass
    skipped client-side), all params compose, 200s.
- Docker compose NOT run — no docker daemon in this environment; verified
  the same pipeline pieces individually (migrate, seed, DB-free build,
  `next start` against local PG16).

## Decisions

- Arc paint slot: after influence circles but before the deferred serif
  labels — the spec's "after circles/stars, before pulses" is internally
  inconsistent with the existing order (stars paint after pulses), so arcs
  go under stars/labels: endpoints' stars and the type layer win over a
  hairline arc.
- Panel glyphs are mono letters (E W T J X); a drawn dash sample was
  judged not worth a canvas-per-list-item.
- `pulseIntensity` gained an optional `window` parameter (default
  unchanged) rather than a second pulse function.
- All 9 links in one `connections.ts` module — every one crosses modules;
  the module comment states when a link may live elsewhere.

## Follow-ups

- Open decisions #6 (arc hit-testing) and #7 (event-page hubs).
- `npm run enrich` still pending egress for wave-2 + people QIDs.
- Docker stack still serves the pre-connections build; rebuild when a
  daemon is available.
