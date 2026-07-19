# 2026-07-19 — People on the globe + faceted filtering

## Task

Faceted filtering (genre × civilization × lens) for the globe's People
view, plus a ~20-person content wave. The task spec assumed a prior
"people-on-globe" branch (view modes, people coords, stars) had merged —
**it had not** (no branch, stash, remote, or session log showed it), so
this session built a minimal spec-faithful foundation first, then the
facets on top.

## What changed

- **Schema**: `people.lat/lng/place` (drizzle/0003, three nullable ADD
  COLUMNs — plain DSL, no custom-migration ceremony needed).
- **Spine format**: `SpinePerson.lat/lng/place` (place of principal
  activity — convention in docs/content-guide.md).
- **Pure logic** (`src/lib/globe.ts`, +8 tests → 67): `personAliveAt`
  (open death = nominal 70y), `filterPeople` (genres ANY-of, periodIds
  ANY-of, both = AND, empty = passthrough), `fanOutCoincident` (exact
  coordinate stacks spread into a ring), `starPeople` (alive + mappable +
  fanned, importance-descending painter's order).
- **Queries**: `getGlobePeople()` (memberships aggregated via
  `array_agg(DISTINCT …)`; `::text` cast because postgres.js doesn't parse
  custom-enum arrays); `getThemeEntityIds` now also returns `personIds`.
- **Shared draw** (`globe-draw.ts`): `GlobeFrame.view` (periods | people |
  both), four-point pigment stars with vellum core, labels at imp ≤ 2 in
  People view only, `DrawResult.stars` for hit-testing. No forked paint.
- **UI** (`app/world/*`): view pill row, genre chips (only genres present
  in the dataset), civilization select (reuses the page's own period rows
  instead of a new `getAllPeriodOptions` query), "N of M people" count,
  Shining side panel (filtered people alive in T, place shown,
  lens-ghosted at 40%), star click → person page. URL:
  `?view=&genre=&civ=` composing with `?lens=&modern=`, router.replace.
- **Content wave**: 23 new people across abbasid, tang, song, world,
  carolingian, cordoba, islamic-bookends, mali, inca, habsburg-spain,
  delhi-sultanate (22 → 45 people). Lens updates: silk-road gains its
  three travelers; islamic-history gains al-Razi, al-Ghazali, al-Zahrawi,
  Ali, Khalid, Suleiman, Sinan, Ibn Battuta.
- **Docs**: features.md (view modes, facets, lens-vs-facet asymmetry, two
  new open decisions), content-guide.md (roles = genres; coords
  convention; Rumi/Ghana gaps), architecture.md, README wave-4 notes +
  decision rows.

## Verification

- 67 tests green, typecheck clean, `next build` clean with DATABASE_URL
  unset (DB-free invariant held).
- Seed: 19 periods / 45 people / 19 events; smoke line unchanged.
- render-globe frames + pixel audit: star arms sample EXACT region pigment
  (al-Zahrawi rgb(71,120,107) = verdigris); spec scenarios hold —
  scholars@1000 → al-Zahrawi only; rulers@1000 → Basil II only;
  unfaceted lens frame shows both (lens never filters).
- Faceted route SSR: `?view=people&genre=artist,scholar&civ=tang-dynasty`
  → 200, "3 of 45 people", chips/select pre-selected, Shining shows
  Li Bai + Du Fu at 751 (Xuanzang †664 — filtered set includes him; the
  panel is year-scoped so he appears when scrubbed earlier).
- Timeline preview re-rendered against the doubled dataset: 45 threads
  pack, dynamic height grows, no draw changes needed.

## Decisions

Durable ones mirrored to the README log (lens dims vs facets filter;
role enum = genre system; principal-activity coords; Sundiata excluded
from islamic-history; star labels imp ≤ 2). Session-local judgment calls:

- Built the missing prerequisite inline rather than blocking — the spec
  leaked enough of its design (coords schema, `?view=`, stars, Shining
  panel, `frame.people`) to reconstruct it minimally.
- Beyond-spec lens memberships added for consistency with each module's
  existing pattern: al-Razi + al-Ghazali → islamic-history (all other
  Abbasid people are members), Kalidasa → subcontinent (mirrors
  Aryabhata). Flagged for review.
- Su Shi seeded at Hangzhou per the spec's explicit "use Hangzhou" note.
- QIDs only on marco-polo, kublai-khan, cervantes, suleiman, ibn-battuta
  (best-effort, tripwire verifies) — spec's list, comments say so.

## Patch session (same day): founding coords + star lifecycle fade

A follow-up spec patched the gaps the reconstructed foundation left:

- **Coords for the 22 founding people** (pre-wave figures: Harun, al-Ma'mun,
  al-Khwarizmi, Genghis, Taizong, Du Fu, Wu Zetian, Umar, Mehmed II,
  Justinian, Aryabhata, Mansa Musa, Charlemagne, Abd al-Rahman III, Shen
  Kuo, Pachacuti, Philip II, Chandragupta, Ashoka, Razia, Aurangzeb,
  Akbar). After re-seed: **zero people lack coords** — every one of the 45
  is a star.
- **`personFade`** (`src/lib/globe.ts`, +2 tests → 69): lifeFade REUSED,
  mapped over `{birth_year, death_year}`; star alpha = fade × lens dim in
  `globe-draw.ts`. Open death = no dim-out ramp (starPeople still bounds
  it at nominal 70y — we don't invent a death fade for an unknown death).
- **Verified pre-existing** (no fix needed): event pulses draw in ALL view
  modes (the pulse loop sits outside the view gates); hit priority is
  stars-before-heartlands with star clicks routing to `/people/[id]`.
- **Marquee frame**: `globe-800-people.png` (800 CE, rotation [-30,-35]) —
  Charlemagne (with Alcuin fading at 0.40, †804) and the Baghdad fan-out
  (Harun + al-Khwarizmi + al-Ma'mun) on one hemisphere, pixel-audited from
  DrawResult positions. **Spec deviation, honest**: al-Ma'mun at 14 renders
  at FULL fade, not partial — the shared 10y ramp (which the spec's own
  test expectations pin) can't leave a 14-year-old partial, and forking the
  ramp was forbidden. The frame shows partial fade anyway: Harun samples at
  0.90 (nine years from death), his core measurably dimmer than
  al-Ma'mun's exact-#f6f0e2 one.
- Gate: typecheck, 69 tests, DB-free build, seed, all green; the Shining
  set at 800 = Charlemagne + Harun + al-Khwarizmi + al-Ma'mun + Alcuin
  (verified by running the panel's exact expression against the live DB —
  no headless browser available in this environment).

## Follow-ups

- Facets on the timeline people strip — deferred until globe UX settles
  (open decision #5 in features.md).
- Star label collisions share the heartland-label nudge follow-up
  (open decision #4).
- `npm run enrich` when egress allows, to tripwire the five new QIDs.
- Rumi and Ghana-empire people remain honest gaps awaiting periods.
- The docker app on :3000 still serves the pre-wave build; rebuild the
  stack (`docker compose up --build`) to ship it.
