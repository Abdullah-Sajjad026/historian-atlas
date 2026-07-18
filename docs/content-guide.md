# Content guide — authoring spine modules

The spine is curated TypeScript in `content/spine/`, one module per
civilization (or a small themed cluster). The seed (`npm run seed`) upserts
everything idempotently — re-running after edits is the normal loop, no
rebuild needed.

## Adding a civilization: checklist

1. Create `content/spine/<slug>.ts` exporting a `SpineModule`
   (contract: `content/spine/types.ts`; richest worked example:
   `abbasid.ts`; minimal stubs: `world.ts`).
2. Register it in `content/spine/index.ts` — **array order matters if any
   period's `parentId` points at a period defined in another module: the
   parent's module must come first** (FK enforced; seed is per-module
   two-pass, not global).
3. `npm run seed` → check the "Seed complete" counts and the time-slice
   smoke line.
4. If you added QIDs, note them as unverified until an enrich run; the
   tripwire (`labelLooksWrong` WARN) is the verification mechanism.
5. Eyeball: `npx tsx --tsconfig tsconfig.json scripts/render-preview.ts`
   and `scripts/render-globe.ts` (pick a frame year where your entity is
   alive) — does it sit right in its lane / on the globe?

## Field conventions

**Dates.** Astronomical integers. For anything pre-CE, use `bce(753)` /
`ce(...)` from `src/lib/dates.ts` in the module so intent survives review —
never write `-752` raw. `endYear: null` = ongoing. Certainty enums
(`circa`/`disputed`/`unknown`) per endpoint; use them honestly — the UI
renders "c." and "(disputed)" and users of a history atlas care.

**importance (1–5).** Drives zoom LOD. Calibration used so far:
1 = world-historical, visible fully zoomed out (Abbasids, Tang, Mongols,
Byzantium, Mansa Musa, al-Khwarizmi, Charlemagne, Inca);
2 = major (Rashidun, Gupta, Ghana, most rulers/scholars);
3 = notable events/figures visible at mid zoom (Hagia Sophia consecration,
Tikal–Calakmul). 4–5 reserved for depth not yet used — minor courtiers,
local events. When unsure between two ranks, pick the LESS important;
promotion is cheap, clutter is not.

**region.** GEOGRAPHIC lane, one of the 7 in `REGIONS`. Cultural belonging
is expressed via themes, not region — Córdoba is `europe` + islamic-history
lens, and that tension is a feature. Events take the region where they
HAPPENED (Mansa Musa's hajj is `mena`).

**summary / influence.** 1–3 sentences, specific, no filler. `influence`
on people answers "why does this person matter" in one line. Long narrative
belongs in future MDX pages, not the graph.

**Heartlands (periods).** `centerLat/centerLng` = capital or center of
gravity; `influenceKm` = honest sphere-of-influence radius, NOT maximal
imperial extent for globe drama (Habsburg Spain is 900km Iberian heartland
despite a global empire — documented choice). Omit all three if the entity
doesn't map meaningfully.

**Event coordinates.** `lat/lng` where it happened → globe pulse. Omit if
placeless.

**wikidataQid.** Include when confident; best-effort is acceptable BECAUSE
the enrich tripwire exists — but say so in a comment. Never invent
precision.

**periodIds on events.** Link EVERY period the event touches, across lanes
and modules (Talas: tang+abbasid; Cajamarca: inca+habsburg-spain). Empty
array is legal for events predating all periods (Hijra).

**themeMemberships.** Only if the module contributes to a lens. Themes are
defined centrally in `content/spine/index.ts` (`themeDefs`), memberships
declared per-module.

## Patterns with worked examples

- **Stub predecessor** so a succession chain resolves before the full
  module exists: umayyad-caliphate began life as an importance-2 stub
  inside abbasid.ts. Legitimate; deepen later.
- **Succession across a gap**: song.parentId = tang-dynasty with a comment
  naming the interregnum. parentId means "succeeded", not "contiguous".
- **Deferred cross-links**: inca.ts shipped Cajamarca linked only to the
  Inca with a comment "awaits habsburg-spain"; the link landed with that
  module. Prefer an honest TODO comment over a dangling FK.
- **Cluster modules**: `islamic-bookends.ts` (Rashidun+Ottoman) and
  `world.ts` (four one-per-lane stubs) show that module ≠ strictly one
  civilization when a grouping is more coherent.

## Suggested next modules (from index.ts TODO)

abbasid-cairo (the 1261–1517 Mamluk-hosted caliphate — also fixes the
implicit claim that 1258 ended the Abbasid line entirely), delhi-sultanate
(south-asia lane is thin), aztec (americas), plus: srivijaya/majapahit
(no south-east-asia lane — they'd go in east-asia or force the lane
question), kievan-rus, mughals, safavids, songhai (succeeds Mali).

## What NOT to do

- Don't add an 8th region. Ever. (Invariant 4.)
- Don't store display calendars, don't hand-write year_range values.
- Don't put a theme on an entity row — memberships only.
- Don't paper over uncertainty: circa/disputed flags exist, use them.
- Don't write summaries you haven't verified historically; wrong content in
  a history atlas is worse than missing content.
