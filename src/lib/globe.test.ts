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
  resolveEndpoints,
  linkAlpha,
  linkLensAlpha,
  LINK_PULSE_WINDOW,
  type GlobePeriod,
  type GlobePerson,
  type GlobeLink,
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

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

function link(
  over: Partial<GlobeLink> & Pick<GlobeLink, "id" | "start_year">,
): GlobeLink {
  return {
    kind: "embassy",
    a_type: null,
    a_id: null,
    a_lat: null,
    a_lng: null,
    a_label: null,
    b_type: null,
    b_id: null,
    b_lat: null,
    b_lng: null,
    b_label: null,
    end_year: null,
    importance: 3,
    summary: null,
    group_id: null,
    ...over,
  } as GlobeLink;
}

describe("resolveEndpoints", () => {
  const data = {
    periods: [
      gp({ id: "abbasid-caliphate", start_year: 750, center_lat: 33.31, center_lng: 44.36 }),
      gp({ id: "no-heartland", start_year: 700, center_lat: null, center_lng: null }),
    ],
    people: [
      person({ id: "harun", birth_year: 763, lat: 33.31, lng: 44.36 }),
      person({ id: "coordless", birth_year: 700, lat: null, lng: null }),
    ],
    events: [
      { id: "talas", name: "Battle of Talas", start_year: 751, region: "east-asia", lat: 42.5, lng: 72.2, importance: 2 },
    ],
  };

  it("resolves entity refs to heartland/place/event coords, literals pass through", () => {
    const out = resolveEndpoints(
      link({
        id: "x",
        start_year: 629,
        a_type: "person",
        a_id: "harun",
        b_lat: 25.14,
        b_lng: 85.44,
        b_label: "Nalanda",
      }),
      data,
    )!;
    expect(out[0]).toMatchObject({ lat: 33.31, lng: 44.36, label: "harun", entityType: "person", entityId: "harun" });
    expect(out[1]).toMatchObject({ lat: 25.14, lng: 85.44, label: "Nalanda", entityType: null, entityId: null });

    const pe = resolveEndpoints(
      link({ id: "y", start_year: 751, a_type: "period", a_id: "abbasid-caliphate", b_type: "event", b_id: "talas" }),
      data,
    )!;
    expect(pe[0]).toMatchObject({ lat: 33.31, lng: 44.36, label: "abbasid-caliphate" });
    expect(pe[1]).toMatchObject({ lat: 42.5, lng: 72.2, label: "Battle of Talas" });
  });

  it("returns null when either side is unresolvable — such links are skipped, never a crash", () => {
    // person without coords
    expect(
      resolveEndpoints(
        link({ id: "x", start_year: 700, a_type: "person", a_id: "coordless", b_lat: 0, b_lng: 0, b_label: "0,0" }),
        data,
      ),
    ).toBeNull();
    // period without a heartland
    expect(
      resolveEndpoints(
        link({ id: "y", start_year: 700, a_type: "period", a_id: "no-heartland", b_type: "person", b_id: "harun" }),
        data,
      ),
    ).toBeNull();
    // dangling id (the seed lint fails these, but render must not crash)
    expect(
      resolveEndpoints(
        link({ id: "z", start_year: 700, a_type: "period", a_id: "atlantis", b_type: "person", b_id: "harun" }),
        data,
      ),
    ).toBeNull();
  });
});

describe("linkAlpha", () => {
  it("range links reuse the lifeFade ramp: the embassy peaks at 802, gone by 816", () => {
    // Harun ↔ Charlemagne, 797–807: a 10-year range peaks mid-ramp.
    const embassy = link({ id: "embassy", start_year: 797, end_year: 807 });
    const at802 = linkAlpha(embassy, 802);
    for (let y = 790; y <= 820; y++) {
      expect(linkAlpha(embassy, y)).toBeLessThanOrEqual(at802); // 802 is the peak
    }
    expect(at802).toBeCloseTo(0.5);
    expect(linkAlpha(embassy, 816)).toBe(0);
  });
  it("range links ramp like empires: the gold trade ramps at 905, full by 950", () => {
    const trade = link({ id: "trade", start_year: 900, end_year: 1031 });
    expect(linkAlpha(trade, 905)).toBeCloseTo(0.5);
    expect(linkAlpha(trade, 950)).toBe(1);
    expect(linkAlpha(trade, 899)).toBe(0);
    expect(linkAlpha(trade, 1032)).toBe(0);
  });
  it("point links flare in a tight ±8y pulse window peaking at the year", () => {
    const talas = link({ id: "talas", start_year: 751 });
    expect(linkAlpha(talas, 751)).toBe(1);
    expect(linkAlpha(talas, 755)).toBeCloseTo(0.5);
    expect(linkAlpha(talas, 751 + LINK_PULSE_WINDOW)).toBe(0);
    expect(linkAlpha(talas, 751 - LINK_PULSE_WINDOW - 1)).toBe(0);
  });
});

describe("linkLensAlpha", () => {
  const lens = {
    periodIds: new Set(["abbasid-caliphate"]),
    personIds: new Set(["harun"]),
    eventIds: new Set<string>(),
  };

  it("is 1 with no lens active", () => {
    expect(
      linkLensAlpha(link({ id: "x", start_year: 700, a_type: "period", a_id: "tang-dynasty" })),
    ).toBe(1);
  });
  it("keeps a link lit if ANY entity endpoint is a lens member", () => {
    // member ↔ non-member: stays lit
    expect(
      linkLensAlpha(
        link({ id: "x", start_year: 751, a_type: "period", a_id: "tang-dynasty", b_type: "period", b_id: "abbasid-caliphate" }),
        lens,
      ),
    ).toBe(1);
    // member ↔ literal: stays lit
    expect(
      linkLensAlpha(
        link({ id: "y", start_year: 629, a_type: "person", a_id: "harun", b_lat: 25.14, b_lng: 85.44, b_label: "Nalanda" }),
        lens,
      ),
    ).toBe(1);
  });
  it("ghosts links touching no member; literal endpoints contribute GHOST", () => {
    // non-member ↔ non-member
    expect(
      linkLensAlpha(
        link({ id: "x", start_year: 751, a_type: "period", a_id: "tang-dynasty", b_type: "period", b_id: "song-dynasty" }),
        lens,
      ),
    ).toBe(GHOST_ALPHA);
    // non-member ↔ literal
    expect(
      linkLensAlpha(
        link({ id: "y", start_year: 602, a_type: "person", a_id: "xuanzang", b_lat: 25.14, b_lng: 85.44, b_label: "Nalanda" }),
        lens,
      ),
    ).toBe(GHOST_ALPHA);
    // literal ↔ literal
    expect(
      linkLensAlpha(
        link({ id: "z", start_year: 1325, a_lat: 35.78, a_lng: -5.81, a_label: "Tangier", b_lat: 21.39, b_lng: 39.86, b_label: "Mecca" }),
        lens,
      ),
    ).toBe(GHOST_ALPHA);
  });
  it("treats a missing set for an endpoint's type as empty, not as no-lens", () => {
    expect(
      linkLensAlpha(
        link({ id: "x", start_year: 751, a_type: "event", a_id: "talas", b_type: "event", b_id: "talas" }),
        { periodIds: new Set(["abbasid-caliphate"]) },
      ),
    ).toBe(GHOST_ALPHA);
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
