# 2026-07-19 — Shareable time & place

## Task

Make time and place shareable: `?year=` and `?focus=` on `/world` with
scrub/pause URL write-back, plus deep links between the timeline, entity
pages, and the globe.

**Prerequisite check (prompt chain):** connections merged — verified
`links` table (`src/db/schema.ts`, `drizzle/0004_links.sql`), arc drawing
in `src/lib/globe-draw.ts`, `?links=` handling in `app/world/page.tsx` +
`globe-client.tsx`, `resolveEndpoints`/`linkAlpha`/`linkLensAlpha` tests
in `src/lib/globe.test.ts`. All present (PR #1 merge).

## What changed

- `src/lib/globe.ts` — new pure helpers: `rotationForPoint(lat, lng)` →
  `[-lng, -clamp(lat, ±MAX_PHI)]` (MAX_PHI=80 exported; the drag clamp in
  the client now uses it too) and `clampYear(raw, min, max)` (parse-and-
  clamp for `?year=`; absent/NaN → null). Tests in `globe.test.ts`
  (Baghdad, polar clamp, clamp both ends, rounding, null cases) — 84 total.
- `app/world/page.tsx` — parses `?year=` (clampYear, fallback 751) and
  `?focus=` (resolved against the already-loaded period rows; heartland →
  `rotationForPoint`, otherwise null → default rotation). Passes
  `initialYear`/`initialRotation`/`activeLens` to the client.
- `app/world/globe-client.tsx` — year/rotation state seeded from props;
  debounced (400ms) `router.replace` of `?year=` on scrub/pause, built
  from `window.location.search` so all other params survive; NEVER writes
  during play; rotation drag writes nothing (commented asymmetry); "this
  year on the timeline" bridge link at the top of the side panel
  (carries `?lens=`).
- `src/db/queries.ts` — `getPeriodDetail` now selects
  `center_lat`/`center_lng` (optional detail-only fields on `PeriodRow`)
  to gate the period page's `&focus=`.
- `app/periods/[id]/page.tsx` — header eyebrow links: "the world in
  <start year>" (`&focus=` only with a heartland) and "on the timeline".
- `app/people/[id]/page.tsx` — "the world in <mid-life year>" →
  `/world?year=<mid>&view=both` (mid = `meanwhile.year`; no focus).
- Docs: features.md (shareable-params bullet, new "Deep links between the
  surfaces" section, open decision #8 "timeline `?window=` viewport
  deep-link", event-pages note), architecture.md (pure helpers + client
  URL ownership).

## Verification

- `npm run typecheck` clean; `npm test` 84/84; `npm run build` clean with
  no database running (build stays DB-free).
- Curl against a seeded local Postgres + `next start`:
  `/world?year=800&view=both` → 200, Shining panel renders Charlemagne +
  Harun; `/world?year=99999` → 200, clamped to maxYear (1942);
  `/world?focus=abbasid-caliphate&year=1258` → 200 with
  `initialRotation:[-44.36,-33.31]` in the payload; `/world?focus=bogus` →
  200, `initialRotation:null`; period page emits
  `/world?year=750&focus=abbasid-caliphate`; person page emits
  `/world?year=614&view=both`.
- Playwright audit (scratch script, deleted per the audit pattern):
  scrub → `?year=900` with lens/modern/links/view intact; 1.5s of play
  wrote nothing; pause wrote `?year=923`; reload reproduced year +
  checkbox states; rotation drag left the URL untouched.

## Decisions

- `&focus=` on period links is omitted (not emitted) when the period has
  no heartland — a focus that resolves to nothing shouldn't decorate URLs.
- Person links carry `&view=both` instead of a focus — people aren't
  periods; their star is findable in the People view.
- No timeline year-viewport param invented — recorded as open decision #8
  instead ("timeline `?window=` viewport deep-link").
- Timeline bar click behavior untouched; the timeline↔globe bridge lives
  on entity pages by design.

## Follow-ups

- Event pages (open decision #1) should link `?year=<event year>` when
  they land.
- Open decision #8: design the timeline viewport param before any link
  tries to carry a year into `/timeline`.
