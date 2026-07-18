import { describe, it, expect } from "vitest";
import {
  isBoxVisible,
  lodMaxImportance,
  rangesOverlap,
  buildLanes,
  layoutTimeline,
  hitTest,
  METRICS,
} from "./timeline-layout";
import type { PeriodRow, EventRow } from "@/db/queries";
import type { TimelinePerson } from "./timeline-layout";

/** Minimal period factory. */
function period(over: Partial<PeriodRow> & Pick<PeriodRow, "id" | "start_year">): PeriodRow {
  return {
    name: over.id!,
    kind: "empire",
    end_year: null,
    start_certainty: "exact",
    end_certainty: "exact",
    region: "mena",
    parent_id: null,
    importance: 1,
    summary: null,
    ...over,
  } as PeriodRow;
}

describe("lodMaxImportance", () => {
  it("shows only empires when zoomed far out", () => {
    expect(lodMaxImportance(0.1)).toBe(1);
  });
  it("shows everything at year-level zoom", () => {
    expect(lodMaxImportance(10)).toBe(5);
  });
  it("shows ranks 1-3 at a typical full-view scale (~1.2 px/yr)", () => {
    expect(lodMaxImportance(1.2)).toBe(3);
  });
});

describe("rangesOverlap (inclusive, matches int4range '[]')", () => {
  it("treats a shared boundary year as overlap — Umayyad 661-750 vs Abbasid 750-1258", () => {
    expect(rangesOverlap(661, 750, 750, 1258)).toBe(true);
  });
  it("detects disjoint ranges", () => {
    expect(rangesOverlap(618, 907, 1206, 1368)).toBe(false);
  });
  it("treats null end as ongoing", () => {
    expect(rangesOverlap(1952, null, 2020, 2021)).toBe(true);
  });
});

describe("buildLanes", () => {
  it("packs overlapping periods into separate sub-rows within a lane", () => {
    const lanes = buildLanes([
      period({ id: "umayyad", start_year: 661, end_year: 750 }),
      period({ id: "abbasid", start_year: 750, end_year: 1258 }),
    ]);
    expect(lanes).toHaveLength(1);
    expect(lanes[0]!.rows).toHaveLength(2); // boundary year 750 is shared -> overlap
  });

  it("keeps disjoint periods in one row", () => {
    const lanes = buildLanes([
      period({ id: "a", start_year: 100, end_year: 200 }),
      period({ id: "b", start_year: 300, end_year: 400 }),
    ]);
    expect(lanes[0]!.rows).toHaveLength(1);
    expect(lanes[0]!.rows[0]).toHaveLength(2);
  });

  it("orders lanes by the fixed REGIONS order and skips empty regions", () => {
    const lanes = buildLanes([
      period({ id: "m", start_year: 750, region: "mena" }),
      period({ id: "t", start_year: 618, region: "east-asia" }),
    ]);
    expect(lanes.map((l) => l.region)).toEqual(["east-asia", "mena"]);
  });
});

describe("layoutTimeline + hitTest", () => {
  const identityX = (year: number) => year; // 1 px per year
  const lanes = buildLanes([
    period({ id: "tang", start_year: 618, end_year: 907, region: "east-asia" }),
    period({ id: "abbasid", start_year: 750, end_year: 1258, region: "mena" }),
  ]);
  const events: EventRow[] = [
    {
      id: "talas",
      name: "Battle of Talas",
      start_year: 751,
      end_year: null,
      certainty: "exact",
      region: "east-asia",
      importance: 1,
      summary: null,
    },
  ];
  const layout = layoutTimeline(lanes, events, identityX, 1);

  it("produces a box per visible period with correct pixel extents", () => {
    const tang = layout.boxes.find((b) => b.id === "tang")!;
    expect(tang.x).toBe(618);
    expect(tang.w).toBe(907 - 618);
  });

  it("LOD-filters low-importance periods when zoomed out", () => {
    const withMinor = buildLanes([
      period({ id: "big", start_year: 0, end_year: 1000, importance: 1 }),
      period({ id: "small", start_year: 100, end_year: 200, importance: 4 }),
    ]);
    const zoomedOut = layoutTimeline(withMinor, [], identityX, 0.3); // maxImp 2
    expect(zoomedOut.boxes.map((b) => b.id)).toEqual(["big"]);
  });

  it("hitTest resolves a point inside a period bar", () => {
    const tang = layout.boxes.find((b) => b.id === "tang")!;
    const hit = hitTest(layout, tang.x + 10, tang.y + 10);
    expect(hit?.id).toBe("tang");
  });

  it("hitTest prefers event markers over bars and misses empty space", () => {
    const talas = layout.eventBoxes.find((e) => e.id === "talas")!;
    expect(hitTest(layout, talas.cx, talas.cy)?.id).toBe("talas");
    expect(hitTest(layout, 5, 5)).toBeNull(); // axis strip
  });

  it("stacks lanes without vertical overlap", () => {
    const [a, b] = layout.laneTops;
    expect(b!.top).toBeGreaterThanOrEqual(a!.top + a!.height + METRICS.laneGap - 1);
  });
});

describe("labelSpace + culling", () => {
  const identityX = (year: number) => year;

  it("measures the gap to the next bar in the same row", () => {
    const lanes = buildLanes([
      period({ id: "a", start_year: 100, end_year: 200 }),
      period({ id: "b", start_year: 300, end_year: 400 }),
    ]);
    const layout = layoutTimeline(lanes, [], identityX, 1);
    const a = layout.boxes.find((b) => b.id === "a")!;
    const b = layout.boxes.find((b) => b.id === "b")!;
    expect(a.labelSpace).toBe(100); // 300 - 200
    expect(b.labelSpace).toBe(Infinity); // last in row
  });

  it("bars in different rows don't constrain each other's labels", () => {
    const lanes = buildLanes([
      period({ id: "u", start_year: 661, end_year: 750 }),
      period({ id: "ab", start_year: 750, end_year: 1258 }), // overlap -> other row
    ]);
    const layout = layoutTimeline(lanes, [], identityX, 1);
    expect(layout.boxes.find((b) => b.id === "u")!.labelSpace).toBe(Infinity);
  });

  it("culls boxes fully outside the viewport, keeps ones bleeding in", () => {
    expect(isBoxVisible({ x: -500, w: 100 }, 1200)).toBe(false);
    expect(isBoxVisible({ x: -250, w: 100 }, 1200)).toBe(true); // within margin
    expect(isBoxVisible({ x: 1500, w: 100 }, 1200)).toBe(false);
    expect(isBoxVisible({ x: 600, w: 100 }, 1200)).toBe(true);
  });
});

describe("people strip", () => {
  const identityX = (year: number) => year;
  const lanes = buildLanes([
    period({ id: "abbasid", start_year: 750, end_year: 1258, region: "mena" }),
  ]);
  const people: TimelinePerson[] = [
    { id: "harun", name: "Harun", birth_year: 763, death_year: 809, importance: 2, region: "mena" },
    { id: "mamun", name: "Ma'mun", birth_year: 786, death_year: 833, importance: 2, region: "mena" },
    { id: "late", name: "Late", birth_year: 900, death_year: 970, importance: 2, region: "mena" },
    { id: "other-lane", name: "X", birth_year: 800, death_year: 860, importance: 2, region: "europe" },
  ];

  it("is hidden below the zoom threshold", () => {
    const zoomedOut = layoutTimeline(lanes, [], identityX, 1, people);
    expect(zoomedOut.personBoxes).toHaveLength(0);
  });

  it("packs overlapping lifespans into rows and skips other lanes", () => {
    const layout = layoutTimeline(lanes, [], identityX, 3, people);
    expect(layout.personBoxes.map((p) => p.id).sort()).toEqual(["harun", "late", "mamun"]);
    const harun = layout.personBoxes.find((p) => p.id === "harun")!;
    const mamun = layout.personBoxes.find((p) => p.id === "mamun")!;
    const late = layout.personBoxes.find((p) => p.id === "late")!;
    expect(harun.y).not.toBe(mamun.y); // overlapping lives -> different rows
    expect(late.y).toBe(harun.y); // disjoint from harun -> same row
    expect(harun.labelSpace).toBe(900 - 809); // gap to 'late' in the same row
  });

  it("adds people strip height to the lane and keeps hitTest working", () => {
    const without = layoutTimeline(lanes, [], identityX, 3, []);
    const withP = layoutTimeline(lanes, [], identityX, 3, people);
    expect(withP.totalHeight).toBeGreaterThan(without.totalHeight);
    const harun = withP.personBoxes.find((p) => p.id === "harun")!;
    expect(hitTest(withP, harun.x + 5, harun.y + 5)?.id).toBe("harun");
  });
});
