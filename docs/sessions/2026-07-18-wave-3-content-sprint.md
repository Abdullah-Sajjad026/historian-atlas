# 2026-07-18 — Wave 3 content sprint (first BCE content, two new lenses)

## Task

Content sprint, spec provided up front: add three south-asia periods
(Maurya, Delhi Sultanate, Mughals), two lenses (The Silk Road, The
Subcontinent), and a Silk Road events module. Pure content + lens config —
no schema changes, no new deps. The headline risk: Maurya is the atlas's
FIRST BCE content, so pre-CE rendering had never run against live data.

## What changed

Commits `228a03d` (content) and `823640e` (README record).

- New spine modules: `maurya.ts`, `delhi-sultanate.ts`, `mughal.ts`,
  `silk-road-events.ts` — registered in `index.ts` with FK-safe ordering
  (delhi before mughal; mughal-empire.parentId → delhi-sultanate).
- Two lenses added to `themeDefs`; Gupta/Aryabhata joined subcontinent via
  `world.ts`; Delhi/Mughal entities joined islamic-history (now four lanes).
- Permanent BCE preview frames added to `scripts/render-preview.ts`
  (`[bce(400), 100]`) and `scripts/render-globe.ts` (`bce(250)`).
- Docs: lens list + two proven edge cases in `docs/features.md`; Content
  status, Wave 3 notes, and five decisions-log rows in `README.md`.

## Verification

- typecheck clean, 59/59 tests, seed → 19 periods / 22 people / 19 events /
  3 themes, smoke line printed.
- BCE timeline PNG inspected: axis ticks "351 BCE … 1 BCE … 50 CE" via
  `formatYear` (no raw negatives), Maurya bar + Kalinga lozenge at the
  mathematically correct pixels. Nit found and recorded (features.md): d3
  picks round astronomical ticks, so labels read "301 BCE" not "300 BCE".
- Globe PNG at 250 BCE: Pataliputra heartland circle, Kalinga pulse fading.
- Throwaway ghosting audit (1600 CE, subcontinent lens): Mughal full
  pigment, Ottoman/Habsburg/Mali ghosted at unchanged size — invariant 3
  holds with zero draw-code changes.
- LensPicker measureText audit at 380px: exactly 2 lines with four pills.
- Routes 200 with correct memberships in served HTML: /themes/silk-road,
  /themes/subcontinent, /timeline?lens=silk-road, /world?lens=subcontinent,
  /periods/maurya-empire, /people/ashoka.

## Decisions

Mirrored into the README decisions log: Delhi kind `kingdom` (not `era`),
no Maurya→Gupta parentId (gap ≠ succession), Mughal parentId →
delhi-sultanate (Panipat 1526 links both periods), silk-road lens has no
people in v1, QIDs only on ashoka/akbar/mughal-empire.

## Follow-ups

- `npm run enrich` tripwire pass to verify the three Wave 3 QIDs.
- BCE tick snapping (round BCE labels instead of round astronomical
  values) — a nicety, not a bug.
- Delhi Sultanate five-dynasty split is a documented deepening seam.
- Re-measure the LensPicker at 380px before adding a fourth lens.
