import { describe, it, expect } from "vitest";
import {
  bce,
  ce,
  formatYear,
  formatYearWithCertainty,
  formatYearRange,
  toHijriYear,
  fromHijriYear,
  formatYearDual,
} from "./dates";

describe("astronomical year numbering", () => {
  it("maps BCE years correctly (no year zero in human calendars)", () => {
    expect(bce(1)).toBe(0); // 1 BCE is astronomical 0
    expect(bce(2)).toBe(-1);
    expect(bce(753)).toBe(-752); // founding of Rome
  });

  it("rejects non-positive human years", () => {
    expect(() => bce(0)).toThrow(RangeError);
    expect(() => ce(-5)).toThrow(RangeError);
  });

  it("round-trips through formatting", () => {
    expect(formatYear(bce(753))).toBe("753 BCE");
    expect(formatYear(bce(1))).toBe("1 BCE");
    expect(formatYear(ce(1))).toBe("1 CE");
    expect(formatYear(750)).toBe("750 CE");
  });
});

describe("certainty-aware formatting", () => {
  it("prefixes circa and suffixes disputed", () => {
    expect(formatYearWithCertainty(570, "circa")).toBe("c. 570 CE");
    expect(formatYearWithCertainty(-752, "disputed")).toBe("753 BCE (disputed)");
    expect(formatYearWithCertainty(100, "unknown")).toBe("unknown");
  });
});

describe("range formatting", () => {
  it("collapses era when both endpoints share it", () => {
    expect(formatYearRange({ startYear: 750, endYear: 1258 })).toBe(
      "750 – 1258 CE",
    );
    expect(formatYearRange({ startYear: bce(753), endYear: bce(510) })).toBe(
      "753 – 510 BCE",
    );
  });

  it("keeps both eras when the range crosses the boundary", () => {
    expect(formatYearRange({ startYear: bce(28), endYear: 476 })).toBe(
      "28 BCE – 476 CE",
    );
  });

  it("handles ongoing periods", () => {
    expect(formatYearRange({ startYear: 1952, endYear: null })).toBe(
      "1952 CE – present",
    );
  });

  it("does not collapse era under a circa start (ambiguity guard)", () => {
    expect(
      formatYearRange({ startYear: 750, endYear: 1258, startCertainty: "circa" }),
    ).toBe("c. 750 CE – 1258 CE");
  });
});

describe("Hijri approximation", () => {
  it("anchors at the Hijra", () => {
    expect(toHijriYear(622)).toBe(1);
  });

  it("is within ±1 year of known reference points", () => {
    // Known pairs (Gregorian CE -> AH): 750 -> 132/133, 1258 -> 656,
    // 1453 -> 857, 1924 -> 1342/1343, 2026 -> 1447/1448.
    const refs: Array<[number, number]> = [
      [750, 133],
      [1258, 656],
      [1453, 857],
      [1924, 1343],
      [2026, 1447],
    ];
    for (const [g, ah] of refs) {
      expect(Math.abs(toHijriYear(g) - ah)).toBeLessThanOrEqual(1);
    }
  });

  it("round-trips within ±1 year", () => {
    for (const g of [622, 700, 900, 1258, 1500, 1900, 2026]) {
      expect(Math.abs(fromHijriYear(toHijriYear(g)) - g)).toBeLessThanOrEqual(1);
    }
  });

  it("rejects pre-Hijra input", () => {
    expect(() => toHijriYear(600)).toThrow(RangeError);
  });

  it("formats dual-calendar labels, falling back before 622 CE", () => {
    expect(formatYearDual(750)).toBe("750 CE / 133 AH");
    expect(formatYearDual(500)).toBe("500 CE");
  });
});
