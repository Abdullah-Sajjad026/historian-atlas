# 2026-07-18 — Modern borders globe overlay (+ repo goes under git)

## Task

Add a "Modern borders" toggle to `/world`: overlay today's country
boundaries and labels on the globe so historical spheres of influence read
against the modern map ("what was on Pakistan's territory in 900 CE").
Spec provided up front: world-atlas countries-110m (already installed, no
new deps), pure tested label selection, all painting in the shared draw
module, `?modern=1` URL state composing with `?lens=`. Mid-session ask:
`git init` the repo and record that it uses pnpm.

## What changed

Commit `7641f48` (the repo's initial commit — baseline app + this feature).

- New pure module `src/lib/modern-borders.ts`: `selectCountryLabels` —
  d3 `geoArea` ≥ 0.025 sr (~1M km²) OR a 43-country allowlist, positioned
  at `geoCentroid`. 7 tests against the real bundled data (suite 52 → 59).
- `src/lib/globe-draw.ts`: `GlobeFrame.modern?: ModernOverlay`
  (`{enabled, borders, labels}`). Dashed hairline borders after land /
  under the pigment circles; tiny uppercase mono labels after circles;
  three inline back-hemisphere checks unified into one `onFront()` helper;
  heartland markers + serif labels moved to a deferred final pass.
- Thin shells: checkbox + `router.replace` URL sync in
  `app/world/globe-client.tsx`, `?modern=` read in `app/world/page.tsx`,
  two overlay frames in `scripts/render-globe.ts` (modern, lens+modern).
- Docs: globe sections of `docs/features.md` and `docs/architecture.md`.
- Housekeeping: `git init -b main`, `.next/` gitignored, pnpm note in
  CLAUDE.md.

## Verification

- typecheck clean, 59/59 tests, `next build` clean and still DB-free.
- Preview PNGs inspected — **the loop caught a real bug again**: country-
  label vellum halos punched holes through the serif heartland labels
  ("Abbasid Caliphate" struck by AFGHANISTAN's halo). Fix: heartland
  labels deferred to a final pass so they always paint on top.
- Combined lens+modern frame proves the overlay never ghosts: Tang/
  Byzantine/Ghana dimmed, borders + country labels at constant strength.
- `/world?modern=1` and `/world?modern=1&lens=islamic-history` both 200,
  checkbox SSRs checked; docker stack rebuilt and healthy on :3000.

## Decisions

- **Overlay is constant by design** — ignores year, `lifeFade`, and
  `lensAlpha`; it is the reference grid a lens is read against (recorded
  in features.md).
- Borders stroked from a topojson interior-borders `mesh` (`a !== b`),
  not the feature outlines — shared borders draw once at intended alpha,
  coastlines never re-dashed. `feature()` still used for label selection.
- Allowlist matches countries-110m spellings exactly ("Turkey",
  "United States of America", "Dem. Rep. Congo"); a no-drift test asserts
  every allowlisted name resolves against the dataset.
- Bundle impact recorded at actuals: ~108KB raw / ~39KB gz (the spec
  guessed ~250KB).

## Follow-ups

- Country-label density at low zoom is acceptable but unaudited on the
  Americas/Pacific views — worth one preview frame if it ever looks busy.
- Heartland label nudging (features.md open decision #4) now also governs
  serif-vs-mono collisions; same future fix covers both.
