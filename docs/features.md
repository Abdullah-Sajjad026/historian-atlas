# Features — what exists, how it behaves, where it lives

## Routes

| Route | What it is | Key files |
|---|---|---|
| `/` | Civilizations grouped by region lane + lens list | `app/page.tsx` |
| `/periods/[id]` | Period detail: succession, people-with-roles, events, enrichment image, **ConcurrentRail** | `app/periods/[id]/page.tsx`, `getPeriodDetail` |
| `/people/[id]` | Person detail: lifespan, memberships, **MeanwhileRail** at mid-life | `app/people/[id]/page.tsx`, `getPersonDetail` |
| `/themes/[id]` | Lens page: subgraph lists, dual Hijri years, links into lensed timeline/globe | `app/themes/[id]/page.tsx` |
| `/timeline` | Zoomable multi-lane Canvas timeline; `?lens=` ghosting | `app/timeline/*`, `src/lib/timeline-*` |
| `/world` | Interactive orthographic globe + year scrubber; `?lens=` ghosting | `app/world/*`, `src/lib/globe*` |

All routes `force-dynamic`. Entity pages have `generateMetadata`
(title/description/OG from summary or influence).

## The Meanwhile rails (product signature)

Every entity page shows "what else was happening":
- **Person pages** → `MeanwhileRail` (app/components.tsx): point time-slice
  at mid-life via `getTimeSlice` — periods alive + events within ±25y.
- **Period pages** → `ConcurrentRail`: RANGE-OVERLAP concurrency (never
  midpoint — see gotchas), excluding the period itself and events already
  listed on the page.

## Timeline behaviors

- Zoom/pan: d3-zoom on the canvas, scaleExtent [0.8, 300], translateExtent
  padded ±200px around the data domain. Canvas height is DYNAMIC (grows as
  LOD reveals rows / the people strip).
- LOD by px-per-year (`lodMaxImportance`): ~0.25→imp1 only … ≥6→everything.
  Events render one rank stricter than periods.
- **People threads** appear at ≥2.5 px/yr: 55%-alpha lifespan bars with a
  solid birth tick, packed rows, mono labels. Person's lane = earliest
  period membership. Open death → nominal 70y span for geometry only.
- Labels: inside the bar when it fits (clamped to viewport for long bars);
  beside the bar only if `labelSpace` (gap to next bar in the row) fits;
  otherwise skipped — the hover tooltip reveals the name. Same rule for
  person threads.
- Hit priority events > people > periods; click → entity page (events
  currently no-op on click — they have no pages yet, a deliberate open
  decision). Tooltip shows name + years.
- Draw culling: boxes outside viewport±200px skipped.
- `?lens=<theme>` ghosts non-member bars/lozenges to 0.15 alpha; unknown
  lens id degrades to unlensed. Lens picker pills rendered by
  `app/lens-picker.tsx` (server component, pure links).

## Globe behaviors (`/world`)

- Orthographic "antique celestial globe": lit vellum sphere, ground shadow,
  graticule, ink coastlines (world-atlas land-110m, bundled ~100KB raw).
- Civilizations = translucent pigment **spheres of influence** around a
  heartland (center_lat/lng + influence_km). DELIBERATELY not borders —
  per-year historical boundary polygons are a licensing problem
  (GeaCron-scale). Stated on the page. Schema seam ready if real borders
  ever land: swap circle for a geometry column; the path() call barely
  changes.
- **Empires breathe**: `lifeFade` ramps radius+alpha over first/last 10y
  (floor 0.08). Emergent truth: the Abbasid circle is small at Talas (751)
  because the caliphate was one year old.
- **Events flare**: expanding rings for ±15y around the date
  (`pulseIntensity`), pigment by region.
- Interactions: drag rotates (φ clamped ±80°), wheel zooms (0.8–2.6),
  scrubber sets year (dual CE/AH readout via `formatYearDual`), **Play
  history** animates at 14 yr/s via rAF, pausing at maxYear. Heartland
  click (10px radius) → period page.
- Side panel: "Alive in <year>" list + "Flaring" events, lens-ghosted
  entries at 40% opacity when a lens is active.
- `?lens=` ghosts circles/pulses: ALPHA ONLY (size unchanged), stroke floor
  ~0.3 so outlines stay legible.
- **Modern borders** (`?modern=1`, checkbox in the controls row, default
  off): overlays today's country boundaries + labels so historical reach
  reads against the modern map ("what was on Pakistan's territory in
  900 CE"). Borders are hairline dashed ink-soft, drawn after land but
  UNDER the influence circles; labels are tiny uppercase mono at low
  alpha, over the circles but under the serif heartland labels (drawn in a
  deferred final pass so they always win). The overlay is CONSTANT and
  UN-GHOSTED **by design** — it ignores year, `lifeFade`, and `lensAlpha`
  (it is the reference grid a lens is read against). Label selection is
  pure/tested: `selectCountryLabels` (`src/lib/modern-borders.ts`) —
  d3 `geoArea` ≥ 0.025 sr (~1M km²) OR a curated allowlist (Pakistan et
  al.), positioned at `geoCentroid`, front-hemisphere gated. Toggle syncs
  the URL via `router.replace` (composes with `?lens=`). Bundle impact:
  world-atlas countries-110m ~108KB raw / ~39KB gz, bundled at module
  scope like land-110m; borders stroked from a topojson interior-borders
  `mesh` (a !== b) so shared borders draw once and coastlines are never
  re-dashed.

## Search (`app/search-box.tsx`)

Header client component over `getSearchIndex()` (all periods/people/events/
themes, fetched in the root layout). Substring filter from 2 chars, top 8,
arrow keys + Enter, Escape closes, mousedown-preventDefault so blur doesn't
eat clicks. Events route to `/timeline` (no event pages yet). Client-side
by design — the spine is curated and small; revisit past a few thousand
entries.

## Lens system

Themes are lenses. `theme_memberships` → `getThemeEntityIds` → Sets passed
to both canvases → `lensAlpha` (pure, tested). Semantics everywhere:
member = full strength, non-member = ghost, nothing hidden.

Current lenses (defined in `content/spine/index.ts` themeDefs):
- **islamic-history** — spans FOUR lanes (mena, europe via Córdoba,
  sub-saharan-africa via Mali, south-asia via Delhi Sultanate + Mughals)
  and 622–1922 with dual-calendar display (`calendarMode: "dual-hijri"`).
- **silk-road** — periods only + two events (Talas, Marco Polo's journey);
  deliberately no people in v1 (membership declared in
  `silk-road-events.ts`).
- **subcontinent** — Maurya through the Mughals, incl. Gupta/Aryabhata
  (memberships declared in the south-asia modules + `world.ts`).

The LensPicker pill row flex-wraps; measured at 380px viewport it takes
exactly 2 lines with four pills — at the budget, not over it. If a fourth
lens is added, re-measure before assuming the pill row still fits.

## Enrichment display

Period pages render `enrichment.imageFile` (Commons Special:FilePath,
width=900) with an "image via wikimedia commons · <description>" eyebrow
caption. Curated fields always win; enrichment is fallback/supplement only.
Proven end-to-end by injecting a fixture row and curling the page.

## Content model highlights (see docs/content-guide.md for authoring)

Structural edge cases the format has PROVEN (don't regress them):
- Cross-lane succession: umayyads-of-cordoba (EUROPE) ← umayyad-caliphate (MENA)
- Cross-lane events: battle-of-talas (Tang+Abbasid), coronation-of-charlemagne
  (Carolingian+Byzantine), mansa-musa-hajj (Mali period, MENA-lane event)
- Cross-HEMISPHERE event: cajamarca (inca-empire + habsburg-spain)
- Period-less event: hijra (`periodIds: []`)
- Disputed/circa dates rendering: Wu Zetian "(disputed)", "c. 570 CE"
- Succession bridging a gap: song-dynasty parentId → tang-dynasty across
  the Five Dynasties interregnum
- BCE content: maurya-empire (c. 322–184 BCE via `bce()`) — axis ticks,
  entity pages, and the globe all render pre-CE years through `formatYear`
  (note: d3 picks round ASTRONOMICAL ticks, so BCE labels read "301 BCE"
  rather than "300 BCE" — correct, just off-round; a tick-snapping pass is
  a future nicety, not a bug)
- Succession at a hard handoff: mughal-empire parentId → delhi-sultanate,
  with first-battle-of-panipat (1526) linked to BOTH periods

## Deliberately open decisions (do not "fix" without a call)

1. **Event pages** — events have no detail pages; search/timeline route
   them to the timeline. Whether they deserve pages should be decided from
   real usage, not speculation.
2. **Empty lanes** — `buildLanes` skips regions with no periods. Revisit
   whether to render empty lanes as invitations once the spine is denser.
3. **Timeline lens vs LOD interaction** — ghosted entities still occupy
   layout rows; an alternative (collapse ghosted rows) trades context for
   density. Current choice is deliberate (lens ≠ filter).
4. **Globe label collisions** — heartland labels can overlap when centers
   are close (Byzantine/Ottoman share Constantinople). Acceptable at
   current density; needs a nudge algorithm eventually.
