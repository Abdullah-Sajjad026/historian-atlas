# 2026-07-19 — Event detail pages (`/events/[id]`)

## Task

Give events detail pages that act as HUBS: what happened, who it involved
(participant periods), connections touching the event, the world at that
moment, and doors into the globe and timeline. Resolves open decisions #1
(event pages) and #7 (event-page hubs) in docs/features.md.

**Prerequisite check** (prompt-chain guard, docs/workflow.md): both
prerequisites verified present before writing anything — the `links` table
+ `resolveEndpoints`/arc pipeline (globe-connections, PR #1) and
`?year=`/`?focus=` on `/world` with `clampYear`/`rotationForPoint`
(shareable-time-place, PR #2). Checked in schema.ts, globe.ts, world/page.tsx
— artifacts, not just log messages.

## What changed

- `src/db/queries.ts` — `getEventDetail(id)`: event row (+ enrichment,
  lat/lng), participant periods via `event_periods`, links touching the
  event as an endpoint (other-endpoint names resolved; dangling ids fall
  back to the slug), and `moment` = `getTimeSlice(start_year)` with the
  event itself filtered from the ±25y events window (REUSED the core
  primitive — no new slice query; self-exclusion mirrors ConcurrentRail).
- `app/events/[id]/page.tsx` — new route, period-page grid (article +
  rail). Header eyebrow/years-with-certainty/summary/enrichment figure;
  Participants as `PeriodRowItem`s ("Predates every period in the atlas."
  for the Hijra's deliberate `periodIds: []`); Connections section only
  when links exist; MeanwhileRail (point-sample — an event is a moment;
  the point-vs-overlap rule from architecture.md, commented in place).
- `src/lib/globe.ts` — `clampCoord` (clampYear's contract, ±bound, keeps
  fraction) + tests. `/world` grew `?lat=&lng=` beside `?focus=` (~10
  lines in `app/world/page.tsx`): same `rotationForPoint`, `?focus=` wins,
  silent degrade. Decision recorded in features.md: centering SHIPPED
  (the extension stayed clean), so event world-doors carry
  `?year=&links=1&lat=&lng=`.
- Referrers rewired: search events → `/events/[id]`; timeline event
  lozenge click navigates (was a deliberate no-op); globe "Flaring" names
  link; period-page Events names link.
- Docs: features.md (routes row, rails, deep links, search, open-decision
  renumber 8→6), architecture.md (getEventDetail, clampCoord, rails).

## Verification

- `typecheck` clean; 87 vitest tests green (incl. new clampCoord cases).
- Curls against `next start` + seeded Postgres 16: siege-of-baghdad-1258
  200 with correct `<title>` and Abbasid + Mongol participants; hijra 200
  with the predates note; cajamarca 200 with Inca + Habsburg Spain (both
  hemispheres); bogus → 404.
- Connections proven by fixture-injection (the enrichment precedent): a
  `links` row `event:siege-of-baghdad-1258 ↔ period:mongol-empire`
  rendered kind + linked endpoint + years + summary; deleted after.
- `?lat/&lng` verified through the RSC payload: rotation `[-44.36,-33.31]`
  from coords; `?focus=` wins when both present; `lat=999&lng=200` clamps
  to `[-180,-80]`; bare `/world` unaffected. Search `/events/` hrefs
  verified in the compiled layout chunk (they're client-computed, not in
  the RSC payload).
- Timeline check done in real Chromium (playwright-core scratch script,
  deleted): zoomed to the 750s anchored at year 751's x (d3-zoom pointer
  invariance pins the lozenge), tooltip proved "Battle of Talas 751 CE",
  click navigated to `/events/battle-of-talas`. Period-click branch
  untouched.
- Build is DB-free (built with no DATABASE_URL). Compose could NOT be
  exercised: this sandbox's egress policy blocks Docker Hub blob storage
  (403 from cloudfront), so images can't pull. The identical pipeline
  (migrate → seed → build → start against Postgres 16) was run manually
  instead.

## Decisions

- No new rail variant, no new slice query — MeanwhileRail + getTimeSlice
  reused verbatim (the task's own constraint, honored).
- Event world-doors keep `&links=1` explicitly: a hub page's globe door
  should show the connection context even though links default on.
- An event's single `certainty` renders on BOTH endpoints of a range
  ("c. X – c. Y") — one certainty describes the whole date.

## Follow-ups

- No seeded `links` rows reference events as endpoints yet — the
  Connections section is fixture-proven but dormant until content lands
  (natural first candidate: talas ↔ transmission-of-paper).
