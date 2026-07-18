/**
 * Timeline layout — PURE functions only. No DOM, no canvas, no d3.
 * The renderer (app/timeline/timeline-client.tsx) is a thin shell over this
 * module, so all the geometry and LOD logic is unit-testable in isolation.
 *
 * Coordinate model: the caller supplies `xOf(year) -> px` (a rescaled d3
 * linear scale under the current zoom transform); this module never knows
 * about zoom itself, only the resulting pixel positions.
 */

import { REGIONS, type Region } from "@/db/schema";
import type { PeriodRow, EventRow } from "@/db/queries";
import { ONGOING } from "@/lib/dates";

/** Minimal person shape for the timeline (region = first period membership). */
export interface TimelinePerson {
  id: string;
  name: string;
  birth_year: number;
  death_year: number | null;
  importance: number;
  region: Region;
}

/** People appear only at human-scale zoom — below this, empires only. */
export const PEOPLE_MIN_PX_PER_YEAR = 2.5;

// ---------------------------------------------------------------------------
// LOD: how much detail is visible at the current zoom?
// ---------------------------------------------------------------------------

/**
 * Map pixels-per-year to the maximum `importance` rank that should render.
 * importance 1 = empires (always visible), 5 = minor detail (year-level zoom).
 * Thresholds chosen so a 1000-year span on a 1200px screen (1.2 px/yr) shows
 * ranks 1–3, and you must zoom to roughly a human lifetime per screen to see
 * rank 5.
 */
export function lodMaxImportance(pxPerYear: number): number {
  if (pxPerYear >= 6) return 5;
  if (pxPerYear >= 2.5) return 4;
  if (pxPerYear >= 0.8) return 3;
  if (pxPerYear >= 0.25) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// Lane assembly: regions -> lanes, overlapping periods -> sub-rows
// ---------------------------------------------------------------------------

export interface Lane {
  region: Region;
  /** Sub-rows of non-overlapping periods (greedy interval packing). */
  rows: PeriodRow[][];
}

/** Inclusive-range overlap — mirrors the DB's int4range '[]' semantics. */
export function rangesOverlap(
  aStart: number,
  aEnd: number | null,
  bStart: number,
  bEnd: number | null,
): boolean {
  return aStart <= (bEnd ?? ONGOING) && bStart <= (aEnd ?? ONGOING);
}

/**
 * Group periods into region lanes (fixed REGIONS order), packing overlapping
 * periods into separate sub-rows. Greedy first-fit after sorting by start
 * year — optimal row count for interval graphs.
 * Only regions that actually have periods produce a lane (the spine is still
 * growing; empty lanes would dominate the canvas — revisit at ~12 civs).
 */
export function buildLanes(periods: PeriodRow[]): Lane[] {
  const byRegion = new Map<Region, PeriodRow[]>();
  for (const p of periods) {
    (byRegion.get(p.region) ?? byRegion.set(p.region, []).get(p.region)!).push(p);
  }

  const lanes: Lane[] = [];
  for (const region of REGIONS) {
    const ps = byRegion.get(region);
    if (!ps?.length) continue;

    const sorted = [...ps].sort((a, b) => a.start_year - b.start_year);
    const rows: PeriodRow[][] = [];
    for (const p of sorted) {
      const row = rows.find(
        (r) =>
          !r.some((q) =>
            rangesOverlap(p.start_year, p.end_year, q.start_year, q.end_year),
          ),
      );
      if (row) row.push(p);
      else rows.push([p]);
    }
    lanes.push({ region, rows });
  }
  return lanes;
}

// ---------------------------------------------------------------------------
// Geometry: lanes + zoomed scale -> pixel boxes
// ---------------------------------------------------------------------------

export const METRICS = {
  axisHeight: 34,
  laneGap: 14,
  rowHeight: 30,
  rowGap: 6,
  lanePadding: 10,
  laneLabelHeight: 20,
  barRadius: 3,
  eventSize: 9, // lozenge diagonal
  personRowHeight: 16,
  personBarHeight: 5,
  personGap: 3,
  peopleSeparator: 6, // gap between period rows and the people strip
} as const;

export interface PeriodBox {
  kind: "period";
  id: string;
  name: string;
  region: Region;
  startYear: number;
  endYear: number | null;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Pixels of empty row space after this bar before the next bar starts
   *  (Infinity for the last bar in its row). Renderers use it to decide
   *  whether an outside-the-bar label fits without colliding. */
  labelSpace: number;
}

export interface PersonBox {
  kind: "person";
  id: string;
  name: string;
  region: Region;
  birthYear: number;
  deathYear: number | null;
  x: number;
  y: number;
  w: number;
  h: number;
  labelSpace: number;
}

export interface EventBox {
  kind: "event";
  id: string;
  name: string;
  region: Region;
  year: number;
  /** Center coordinates; hit box is a square of METRICS.eventSize around it. */
  cx: number;
  cy: number;
}

export interface TimelineLayout {
  boxes: PeriodBox[];
  personBoxes: PersonBox[];
  eventBoxes: EventBox[];
  laneTops: Array<{ region: Region; top: number; height: number }>;
  totalHeight: number;
}

export function layoutTimeline(
  lanes: Lane[],
  events: EventRow[],
  xOf: (year: number) => number,
  pxPerYear: number,
  people: TimelinePerson[] = [],
): TimelineLayout {
  const maxImp = lodMaxImportance(pxPerYear);
  const showPeople = pxPerYear >= PEOPLE_MIN_PX_PER_YEAR;
  const boxes: PeriodBox[] = [];
  const personBoxes: PersonBox[] = [];
  const eventBoxes: EventBox[] = [];
  const laneTops: TimelineLayout["laneTops"] = [];

  let y = METRICS.axisHeight;
  for (const lane of lanes) {
    const visibleRows = lane.rows
      .map((r) => r.filter((p) => p.importance <= maxImp))
      .filter((r) => r.length > 0);
    if (visibleRows.length === 0) continue;

    // People strip: lifespans packed like periods, gated by zoom + LOD.
    const lanePeople = showPeople
      ? people
          .filter((p) => p.region === lane.region && p.importance <= maxImp)
          .sort((a, b) => a.birth_year - b.birth_year)
      : [];
    const personRows: TimelinePerson[][] = [];
    for (const p of lanePeople) {
      const row = personRows.find(
        (r) =>
          !r.some((q) =>
            rangesOverlap(p.birth_year, p.death_year, q.birth_year, q.death_year),
          ),
      );
      if (row) row.push(p);
      else personRows.push([p]);
    }

    const peopleHeight =
      personRows.length === 0
        ? 0
        : METRICS.peopleSeparator +
          personRows.length * METRICS.personRowHeight +
          (personRows.length - 1) * METRICS.personGap;

    const laneHeight =
      METRICS.laneLabelHeight +
      METRICS.lanePadding * 2 +
      visibleRows.length * METRICS.rowHeight +
      (visibleRows.length - 1) * METRICS.rowGap +
      peopleHeight;
    laneTops.push({ region: lane.region, top: y, height: laneHeight });

    let rowY = y + METRICS.laneLabelHeight + METRICS.lanePadding;
    for (const row of visibleRows) {
      for (let i = 0; i < row.length; i++) {
        const p = row[i]!;
        const x0 = xOf(p.start_year);
        const x1 = xOf(p.end_year ?? ONGOING);
        const next = row[i + 1];
        boxes.push({
          kind: "period",
          id: p.id,
          name: p.name,
          region: p.region,
          startYear: p.start_year,
          endYear: p.end_year,
          x: x0,
          y: rowY,
          w: Math.max(x1 - x0, 2), // never thinner than a hairline
          h: METRICS.rowHeight,
          labelSpace: next ? xOf(next.start_year) - x1 : Infinity,
        });
      }
      rowY += METRICS.rowHeight + METRICS.rowGap;
    }

    // People strip below the period rows.
    if (personRows.length > 0) {
      let personY = rowY - METRICS.rowGap + METRICS.peopleSeparator;
      for (const row of personRows) {
        for (let i = 0; i < row.length; i++) {
          const p = row[i]!;
          const x0 = xOf(p.birth_year);
          const x1 = xOf(p.death_year ?? p.birth_year + 70); // open lives: nominal span
          const next = row[i + 1];
          personBoxes.push({
            kind: "person",
            id: p.id,
            name: p.name,
            region: p.region,
            birthYear: p.birth_year,
            deathYear: p.death_year,
            x: x0,
            y: personY,
            w: Math.max(x1 - x0, 2),
            h: METRICS.personRowHeight,
            labelSpace: next ? xOf(next.birth_year) - x1 : Infinity,
          });
        }
        personY += METRICS.personRowHeight + METRICS.personGap;
      }
    }

    // Events sit on the lane's baseline, LOD-gated one rank stricter than
    // periods (markers clutter faster than bars).
    for (const e of events) {
      if (e.region !== lane.region) continue;
      if (e.importance > Math.max(1, maxImp - 1)) continue;
      eventBoxes.push({
        kind: "event",
        id: e.id,
        name: e.name,
        region: e.region,
        year: e.start_year,
        cx: xOf(e.start_year),
        cy: y + laneHeight - METRICS.lanePadding / 2,
      });
    }

    y += laneHeight + METRICS.laneGap;
  }

  return { boxes, personBoxes, eventBoxes, laneTops, totalHeight: y };
}

// ---------------------------------------------------------------------------
// Hit testing (pointer -> entity)
// ---------------------------------------------------------------------------

export function hitTest(
  layout: TimelineLayout,
  x: number,
  y: number,
): PeriodBox | PersonBox | EventBox | null {
  // Events first — they're small and sit on top of lane chrome.
  const r = METRICS.eventSize;
  for (const e of layout.eventBoxes) {
    if (Math.abs(x - e.cx) <= r && Math.abs(y - e.cy) <= r) return e;
  }
  for (const p of layout.personBoxes) {
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return p;
  }
  for (const b of layout.boxes) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Draw culling
// ---------------------------------------------------------------------------

/** Should this box be painted at all for the current viewport? */
export function isBoxVisible(
  b: Pick<PeriodBox, "x" | "w">,
  viewportWidth: number,
  margin = 200, // covers outside labels bleeding in from just off-screen
): boolean {
  return b.x + b.w >= -margin && b.x <= viewportWidth + margin;
}
