import { describe, it, expect } from "vitest";
import {
  lensAlpha,
  GHOST_ALPHA,
  lifeFade,
  activeAt,
  mappablePeriods,
  kmToDegrees,
  pulseIntensity,
  visibleEvents,
  personAliveAt,
  personFade,
  filterPeople,
  fanOutCoincident,
  starPeople,
  NOMINAL_LIFESPAN,
  type GlobePeriod,
  type GlobePerson,
} from "./globe";

function gp(over: Partial<GlobePeriod> & Pick<GlobePeriod, "id" | "start_year">): GlobePeriod {
  return {
    name: over.id!,
    region: "mena",
    end_year: null,
    center_lat: 33,
    center_lng: 44,
    influence_km: 1000,
    importance: 1,
    ...over,
  } as GlobePeriod;
}

describe("activeAt", () => {
  it("is inclusive on both endpoints", () => {
    const p = gp({ id: "x", start_year: 750, end_year: 1258 });
    expect(activeAt(p, 750)).toBe(true);
    expect(activeAt(p, 1258)).toBe(true);
    expect(activeAt(p, 749)).toBe(false);
    expect(activeAt(p, 1259)).toBe(false);
  });
  it("treats null end as ongoing", () => {
    expect(activeAt(gp({ id: "x", start_year: 1900, end_year: null }), 2500)).toBe(true);
  });
});

describe("mappablePeriods", () => {
  it("drops periods without heartlands and sorts large influence first", () => {
    const out = mappablePeriods(
      [
        gp({ id: "small", start_year: 700, influence_km: 500 }),
        gp({ id: "nogeo", start_year: 700, center_lat: null }),
        gp({ id: "big", start_year: 700, influence_km: 3000 }),
        gp({ id: "dead", start_year: 100, end_year: 200 }),
      ],
      750,
    );
    expect(out.map((p) => p.id)).toEqual(["big", "small"]);
  });
});

describe("kmToDegrees", () => {
  it("converts one degree of arc (~111.32 km)", () => {
    expect(kmToDegrees(111.32)).toBeCloseTo(1, 5);
  });
});

describe("pulses", () => {
  it("peaks at the event year and fades linearly to the window edge", () => {
    expect(pulseIntensity(751, 751)).toBe(1);
    expect(pulseIntensity(751, 758.5)).toBeCloseTo(0.5);
    expect(pulseIntensity(751, 767)).toBe(0);
  });
  it("visibleEvents filters geo-less and out-of-window events", () => {
    const out = visibleEvents(
      [
        { id: "talas", name: "", start_year: 751, region: "east-asia", lat: 42.5, lng: 72.2, importance: 2 },
        { id: "nogeo", name: "", start_year: 751, region: "mena", lat: null, lng: null, importance: 1 },
        { id: "far", name: "", start_year: 900, region: "mena", lat: 10, lng: 10, importance: 1 },
      ],
      755,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe("talas");
    expect(out[0]!.intensity).toBeCloseTo(1 - 4 / 15);
  });
});

describe("lifeFade", () => {
  const p = { start_year: 750, end_year: 1258 };
  it("ramps in over the first decade and out over the last", () => {
    expect(lifeFade(p, 755)).toBeCloseTo(0.5);
    expect(lifeFade(p, 760)).toBe(1);
    expect(lifeFade(p, 1000)).toBe(1);
    expect(lifeFade(p, 1253)).toBeCloseTo(0.5);
  });
  it("floors at a visible minimum inside the lifetime, zero outside", () => {
    expect(lifeFade(p, 750)).toBeCloseTo(0.08);
    expect(lifeFade(p, 749)).toBe(0);
    expect(lifeFade({ start_year: 1900, end_year: null }, 3000)).toBe(1);
  });
});

describe("lensAlpha", () => {
  it("is full strength with no lens active", () => {
    expect(lensAlpha("anything")).toBe(1);
  });
  it("spotlights members and ghosts everything else", () => {
    const lens = new Set(["abbasid-caliphate"]);
    expect(lensAlpha("abbasid-caliphate", lens)).toBe(1);
    expect(lensAlpha("tang-dynasty", lens)).toBe(GHOST_ALPHA);
  });
});

// ---------------------------------------------------------------------------
// People view
// ---------------------------------------------------------------------------

function person(
  over: Partial<GlobePerson> & Pick<GlobePerson, "id" | "birth_year">,
): GlobePerson {
  return {
    name: over.id!,
    death_year: null,
    region: "mena",
    lat: 33.31,
    lng: 44.36,
    place: "Baghdad",
    importance: 2,
    roles: ["scholar"],
    period_ids: ["abbasid-caliphate"],
    ...over,
  } as GlobePerson;
}

describe("personAliveAt", () => {
  it("is inclusive of birth and death years", () => {
    const p = person({ id: "x", birth_year: 780, death_year: 850 });
    expect(personAliveAt(p, 780)).toBe(true);
    expect(personAliveAt(p, 850)).toBe(true);
    expect(personAliveAt(p, 779)).toBe(false);
    expect(personAliveAt(p, 851)).toBe(false);
  });
  it("gives an open death the nominal lifespan, not the ONGOING sentinel", () => {
    const p = person({ id: "x", birth_year: 800 });
    expect(personAliveAt(p, 800 + NOMINAL_LIFESPAN)).toBe(true);
    expect(personAliveAt(p, 801 + NOMINAL_LIFESPAN)).toBe(false);
  });
});

describe("personFade", () => {
  it("is lifeFade mapped over the lifespan — kindles in, dims out", () => {
    // Harun al-Rashid: b. 763, d. 809.
    const p = person({ id: "harun", birth_year: 763, death_year: 809 });
    expect(personFade(p, 768)).toBeCloseTo(0.5); // 5y into the 10y kindle
    expect(personFade(p, 780)).toBe(1); // mid-life, fully lit
    expect(personFade(p, 804)).toBeCloseTo(0.5); // 5y before the dim-out
    expect(personFade(p, 762)).toBe(0); // not yet born
    expect(personFade(p, 810)).toBe(0); // gone
  });
  it("gives an open death no dim-out ramp (starPeople still bounds it)", () => {
    const p = person({ id: "x", birth_year: 800 });
    expect(personFade(p, 800 + NOMINAL_LIFESPAN)).toBe(1);
  });
});

describe("filterPeople", () => {
  const people = [
    person({ id: "razi", birth_year: 865, roles: ["scholar"], period_ids: ["abbasid-caliphate"] }),
    person({ id: "libai", birth_year: 701, roles: ["artist"], period_ids: ["tang-dynasty"] }),
    person({ id: "xuanzang", birth_year: 602, roles: ["explorer", "scholar"], period_ids: ["tang-dynasty"] }),
    person({ id: "basil", birth_year: 958, roles: ["ruler"], period_ids: ["byzantine-empire"] }),
  ];

  it("matches on ANY of the person's roles (genre facet)", () => {
    const out = filterPeople(people, { genres: ["scholar"] });
    expect(out.map((p) => p.id)).toEqual(["razi", "xuanzang"]);
  });
  it("matches on ANY membership (civilization facet)", () => {
    const out = filterPeople(people, { periodIds: ["tang-dynasty"] });
    expect(out.map((p) => p.id)).toEqual(["libai", "xuanzang"]);
  });
  it("ANDs the two facets when both are present", () => {
    const out = filterPeople(people, {
      genres: ["scholar"],
      periodIds: ["tang-dynasty"],
    });
    expect(out.map((p) => p.id)).toEqual(["xuanzang"]);
  });
  it("treats empty or undefined facets as no constraint", () => {
    expect(filterPeople(people, {})).toEqual(people);
    expect(filterPeople(people, { genres: [], periodIds: [] })).toEqual(people);
  });
});

describe("fanOutCoincident", () => {
  it("leaves lone points untouched and spreads exact stacks apart", () => {
    const stack = [
      person({ id: "theodora", birth_year: 500, lat: 41.01, lng: 28.98 }),
      person({ id: "basil", birth_year: 958, lat: 41.01, lng: 28.98 }),
      person({ id: "anna", birth_year: 1083, lat: 41.01, lng: 28.98 }),
      person({ id: "alone", birth_year: 735, lat: 50.78, lng: 6.08 }),
    ] as Array<GlobePerson & { lat: number; lng: number }>;
    const out = fanOutCoincident(stack);
    const alone = out.find((p) => p.id === "alone")!;
    expect([alone.lat, alone.lng]).toEqual([50.78, 6.08]);
    const coords = out
      .filter((p) => p.id !== "alone")
      .map((p) => `${p.lat},${p.lng}`);
    expect(new Set(coords).size).toBe(3); // all three now distinct
    expect(coords).not.toContain("41.01,28.98"); // and none still stacked
  });
});

describe("starPeople", () => {
  it("keeps only mappable people alive in T, important stars painting last", () => {
    const out = starPeople(
      [
        person({ id: "major", birth_year: 940, death_year: 1030, importance: 1 }),
        person({ id: "minor", birth_year: 950, death_year: 1010, importance: 3, lat: 10, lng: 10 }),
        person({ id: "unborn", birth_year: 1058, death_year: 1111 }),
        person({ id: "panel-only", birth_year: 960, death_year: 1020, lat: null, lng: null }),
      ],
      1000,
    );
    expect(out.map((p) => p.id)).toEqual(["minor", "major"]);
  });
});
