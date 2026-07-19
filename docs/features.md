# Features — what exists, how it behaves, where it lives

## Routes

| Route | What it is | Key files |
|---|---|---|
| `/` | Civilizations grouped by region lane + lens list | `app/page.tsx` |
| `/periods/[id]` | Period detail: succession, people-with-roles, events, enrichment image, **ConcurrentRail** | `app/periods/[id]/page.tsx`, `getPeriodDetail` |
| `/people/[id]` | Person detail: lifespan, memberships, **MeanwhileRail** at mid-life | `app/people/[id]/page.tsx`, `getPersonDetail` |
| `/events/[id]` | Event hub: participants (linked periods), connections touching the event, **MeanwhileRail** at the event's year, doors into globe + timeline | `app/events/[id]/page.tsx`, `getEventDetail` |
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
- **Event pages** → `MeanwhileRail` at the event's start year. The
  point-sample variant is CORRECT here (an event is a moment, not a range —
  the point-vs-overlap rule in architecture.md). `getEventDetail` filters
  the event itself out of the slice's ±25y events window, mirroring
  ConcurrentRail's self-exclusion.

## Deep links between the surfaces (time & place bridges)

Entity pages link into the shared canvases with mono-eyebrow links:

- **Period pages** (header, under the year range): "the world in
  <start year>" → `/world?year=<start>&focus=<id>` (`&focus=` only when
  the period has a heartland — a focus with nothing to rotate to is
  omitted, not emitted-and-ignored), and "on the timeline" → `/timeline`.
  Neither link propagates a lens — the page can't know what lens context
  the reader arrived through, so it doesn't guess.
- **Person pages** (header, under the lifespan): "the world in <mid-life
  year>" → `/world?year=<mid>&view=both`. No `&focus=` — people aren't
  periods; `&view=both` puts their star in the frame instead. The mid-life
  year is the same one the MeanwhileRail samples (`meanwhile.year`).
- **Event pages** (header, under the year): "the world in <year>" →
  `/world?year=<start>&links=1` — connections stay explicitly on (an event
  page is a hub; arcs are its context) — plus `&lat=&lng=` when the event
  has a location, centering the globe on it; and "on the timeline" →
  `/timeline`, bare like the period page's. **The ?lat/&lng decision**:
  events have no `?focus=` slug space, so `/world` grew optional
  `?lat=&lng=` handling beside `?focus=` — parsed by `clampCoord` (pure,
  tested; the clampYear contract with a ±bound instead of a domain),
  resolved through the same `rotationForPoint`, and `?focus=` WINS when
  both are present (a named period is the more specific intent). It was a
  clean ~10-line extension, so centering shipped rather than year-only
  links.
- **/world side panel** → "this year on the timeline" bridge at the top
  (carries `?lens=` when active, not the year — open decision #6).
- **Timeline bar click stays exactly as it was** (→ period page). The
  timeline→globe bridge lives on ENTITY pages by design: a click on a bar
  already has a richer destination (the period page, which now carries the
  world link), and overloading the canvas click would cost the existing
  navigation.

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
- Hit priority events > people > periods; click → entity page (event
  lozenges included — they navigate to `/events/[id]`). Tooltip shows
  name + years.
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
- Side panel: "Alive in <year>" list + "Flaring" events (names link to
  their event pages), lens-ghosted entries at 40% opacity when a lens is
  active.
- `?lens=` ghosts circles/pulses: ALPHA ONLY (size unchanged), stroke floor
  ~0.3 so outlines stay legible.
- **View modes** (`?view=people|both`, pill row above the canvas; absent =
  the classic empires view): People renders the humans of the age as
  four-point pigment **stars** at their place of principal activity
  (`people.lat/lng/place`, aggregated by `getGlobePeople`), sized by
  importance, serif-labeled at importance ≤ 2 (People view only — in Both,
  the heartland labels own the type layer). Coincident places fan into a
  small ring (`fanOutCoincident` — three Byzantines share Constantinople).
  Alive-in-T uses `personAliveAt` (open death = nominal 70y, the timeline's
  convention). People kindle and dim exactly the way empires breathe:
  `personFade` is the SAME `lifeFade` ramp mapped over the lifespan (an open
  death gets no dim-out; `starPeople` still drops the star at the nominal
  bound), multiplied with the lens dim into star alpha. Event pulses flare
  in EVERY view mode — the People view is not a dead map. Stars are
  click-through to person pages (hit-tested before heartlands, matching
  their paint order). A "Shining" side
  panel lists the filtered people alive in T (place shown; people without
  coords appear here but never as stars).
- **People facets** (`?genre=scholar,artist&civ=<period-id>`, chips +
  select under the view toggle, People/Both only): genre chips are the
  `person_role` enum values present in the dataset (multi-select, ANY-of);
  the civilization select matches ANY membership; both together AND. A
  count ("12 of 45 people") keeps the narrowing honest. **Facets FILTER,
  the lens DIMS** — deliberately asymmetric: a lens is a spotlight on the
  world (members bright, rest ghosted, nothing hidden), while facets narrow
  which people are in the view at all (they feed both the stars and the
  Shining panel). Facets never touch lens ghosting and vice versa. All
  params compose:
  `?view=&genre=&civ=&lens=&modern=&links=&year=&focus=&lat=&lng=`;
  unknown values degrade silently like `?lens=`.
- **Shareable time & place** (`?year=<int>`, `?focus=<period-slug>`,
  `?lat=&lng=`):
  `?year=` sets the initial scrubbed year, parsed and clamped into
  [minYear, maxYear] by `clampYear` (pure, tested; unparseable → the
  default 751). `?focus=` is an ENTRY HINT resolved server-side: a known
  period with a heartland yields an initial rotation of
  `rotationForPoint(lat, lng)` (= `[-lng, -clamp(lat, ±80°)]`, the same φ
  pole bound as the drag); unknown slug or no heartland degrades silently
  to the default rotation. `?lat=&lng=` is the same entry hint in raw
  coordinates (event pages use it — events have no `?focus=` slug space):
  each parsed and clamped into ±90/±180 by `clampCoord` (pure, tested),
  fed through the same `rotationForPoint`; `?focus=` wins when both are
  present, and either coord missing/unparseable degrades silently.
  Write-back: when the user scrubs or PAUSES
  play, the client debounces 400ms then `router.replace`s `?year=` built
  from the CURRENT search string, so view/lens/modern/links/genre/civ all
  ride along. The URL is NEVER written during active play (a rAF loop
  would spam history) — pausing writes the year you stopped at. Dragging
  rotation writes NOTHING: focus is an entry hint, not tracked state (the
  asymmetry is deliberate and commented in the client). The side panel
  tops out with a "this year on the timeline" bridge link (+ `?lens=`
  when one is active); it cannot carry the year yet — see open decision
  below.
- **Connections** (`?links=0` to hide; absent = on; checkbox next to the
  view toggle): relationships between entities — embassy, war, trade,
  journey, transmission — drawn as **great-circle arcs** between their
  endpoints (d3 geoPath over a two-point LineString; clipAngle hides the
  far side; no hand-rolled interpolation). Endpoints are entity refs
  (period heartland / person place / event location) or literal places
  (lat/lng/label — literals get a small mono label at the arc's end);
  resolution is by `resolveEndpoints` (pure, tested) and IGNORES endpoint
  lifetimes — a transmission may outlive its transmitters (Indian numerals
  reach Baghdad c. 773, two centuries after the Gupta). Temporal life is
  `linkAlpha`: range links REUSE the lifeFade ramp (the gold trade breathes
  like an empire), point links flare in a tight ±8y pulse. Style: ink-soft
  stroke, dash by kind (war solid, embassy [6,4], trade [10,6], journey
  dotted [2,4], transmission [12,3,3,3]), +0.8px width at importance 1,
  2.5px endpoint dots. A lens dims arcs by `linkLensAlpha` — the MAX of
  lensAlpha over the ENTITY endpoints (touch one member and the arc stays
  lit; literal endpoints contribute GHOST) — alpha only, like everything
  else. **Facets do NOT filter arcs** — facets narrow PEOPLE only (the same
  deliberate asymmetry as facets-vs-lens: a faceted People view still shows
  the age's connections in full). The side panel's "Connections" section
  lists links alive at T (mono kind glyph, first clause of the summary,
  mono years, lens-ghosted at 40%); journey hops sharing a `group_id`
  (Ibn Battuta's three) collapse to one entry showing the ACTIVE hop's
  endpoints. Arcs are not hit-testable (open decision below); the panel is
  the click surface. Zero-length arcs (both endpoints one city — the 1453
  war) degrade to the endpoint dots under the heartland marker, verified.
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
eat clicks. Every entity type routes to its own page (events included:
`/events/[id]`, with the start year as the detail column). Client-side
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
- **silk-road** — five periods, two events (Talas, Marco Polo's journey),
  and — since the people-on-globe wave — the three people genuinely tied to
  the road: Xuanzang, Marco Polo, Ibn Battuta (declared in their home
  modules; court figures still don't qualify).
- **subcontinent** — Maurya through the Mughals, incl. Gupta/Aryabhata
  (memberships declared in the south-asia modules + `world.ts`).

The LensPicker pill row flex-wraps; measured at 380px viewport it takes
exactly 2 lines with four pills — at the budget, not over it. If a fourth
lens is added, re-measure before assuming the pill row still fits.

## Enrichment display

Period and event pages render `enrichment.imageFile` (Commons
Special:FilePath, width=900) with an "image via wikimedia commons ·
<description>" eyebrow caption. Curated fields always win; enrichment is fallback/supplement only.
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

(Former #1 "event pages" and #7 "event-page hubs" are RESOLVED: `/events/[id]`
exists — see the routes table — and renders a Connections section for links
touching the event, so an event page IS the hub "everything that met here".)

1. **Empty lanes** — `buildLanes` skips regions with no periods. Revisit
   whether to render empty lanes as invitations once the spine is denser.
2. **Timeline lens vs LOD interaction** — ghosted entities still occupy
   layout rows; an alternative (collapse ghosted rows) trades context for
   density. Current choice is deliberate (lens ≠ filter).
3. **Globe label collisions** — heartland labels can overlap when centers
   are close (Byzantine/Ottoman share Constantinople). Acceptable at
   current density; needs a nudge algorithm eventually. Star labels in the
   People view inherit the same open decision (fan-out separates the stars
   themselves, but two labels a degree apart can still overprint).
4. **Facets on the timeline people strip** — the genre/civilization facets
   exist only on the globe for now; extending them to the timeline strip is
   deliberately deferred until the globe UX settles.
5. **Arc hit-testing** — connection arcs are not clickable/hoverable in v1
   (DrawResult carries per-arc metadata, so the plumbing exists). Hit-testing
   a thin curve needs distance-to-path math the dots/stars don't; decide
   from real usage whether arcs deserve it or the panel entry suffices.
6. **Timeline `?window=` viewport deep-link** — the timeline has no URL
   param for its zoom/pan viewport, so the globe's "this year on the
   timeline" bridge (and any future year-carrying link into the timeline)
   lands on the default view. A `?window=<start>,<end>` param was
   deliberately NOT invented during the shareable-time-place work: the
   timeline's viewport is a d3-zoom transform, and a half-designed param
   would ossify. Decide the shape (center+span vs range? write-back on
   pan?) before adding it.
