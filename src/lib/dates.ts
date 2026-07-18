/**
 * Date utilities for historical time.
 *
 * Canonical internal representation: ASTRONOMICAL YEAR NUMBERING (plain integers).
 *   - Year 1 CE  ->  1
 *   - Year 1 BCE ->  0
 *   - Year 2 BCE -> -1
 *   - Generally: N BCE -> 1 - N
 *
 * Why: arithmetic just works (no missing year zero), range queries are integer
 * comparisons, and Postgres int4range/GiST indexes handle time-slice queries
 * natively. All calendar concerns (BCE/CE labels, Hijri) live in this display
 * layer only — the database never stores calendar-specific values.
 */

export type DateCertainty = "exact" | "circa" | "disputed" | "unknown";

/** Sentinel upper bound for ongoing periods (matches schema's COALESCE). */
export const ONGOING = 3000;

// ---------------------------------------------------------------------------
// Astronomical <-> human-readable conversions
// ---------------------------------------------------------------------------

/** Convert a "N BCE" year to astronomical numbering. bce(753) -> -752 */
export function bce(year: number): number {
  if (!Number.isInteger(year) || year < 1) {
    throw new RangeError(`bce() expects a positive integer year, got ${year}`);
  }
  return 1 - year;
}

/** Convert a "N CE" year to astronomical numbering (identity, for symmetry). */
export function ce(year: number): number {
  if (!Number.isInteger(year) || year < 1) {
    throw new RangeError(`ce() expects a positive integer year, got ${year}`);
  }
  return year;
}

/**
 * Format an astronomical year for display.
 *   formatYear(-752) -> "753 BCE"
 *   formatYear(0)    -> "1 BCE"
 *   formatYear(750)  -> "750 CE"
 */
export function formatYear(astro: number): string {
  if (!Number.isInteger(astro)) {
    throw new RangeError(`formatYear() expects an integer, got ${astro}`);
  }
  return astro <= 0 ? `${1 - astro} BCE` : `${astro} CE`;
}

/**
 * Certainty-aware single-year formatting.
 *   formatYearWithCertainty(750, "circa") -> "c. 750 CE"
 *   formatYearWithCertainty(750, "disputed") -> "750 CE (disputed)"
 */
export function formatYearWithCertainty(
  astro: number,
  certainty: DateCertainty = "exact",
): string {
  switch (certainty) {
    case "exact":
      return formatYear(astro);
    case "circa":
      return `c. ${formatYear(astro)}`;
    case "disputed":
      return `${formatYear(astro)} (disputed)`;
    case "unknown":
      return "unknown";
  }
}

export interface YearRangeParts {
  startYear: number;
  endYear: number | null; // null = ongoing / no clean end
  startCertainty?: DateCertainty;
  endCertainty?: DateCertainty;
}

/**
 * Format a period's range for display.
 *   { 750, 1258 }            -> "750 – 1258 CE"
 *   { -752, -509 }           -> "753 – 510 BCE"
 *   { -27, 476 }             -> "28 BCE – 476 CE"
 *   { 1952, null }           -> "1952 CE – present"
 *   circa start              -> "c. 750 – 1258 CE"
 *
 * Era label is collapsed when both endpoints share it (standard convention).
 */
export function formatYearRange(range: YearRangeParts): string {
  const {
    startYear,
    endYear,
    startCertainty = "exact",
    endCertainty = "exact",
  } = range;

  const startLabel = formatYearWithCertainty(startYear, startCertainty);

  if (endYear === null) {
    return `${startLabel} – present`;
  }

  const endLabel = formatYearWithCertainty(endYear, endCertainty);
  const sameEra = startYear <= 0 === endYear <= 0;

  if (sameEra && startCertainty === "exact") {
    // Collapse the era suffix on the start: "750 – 1258 CE"
    const eraSuffix = startYear <= 0 ? " BCE" : " CE";
    return `${startLabel.replace(eraSuffix, "")} – ${endLabel}`;
  }
  return `${startLabel} – ${endLabel}`;
}

// ---------------------------------------------------------------------------
// Hijri (Islamic calendar) — YEAR-LEVEL APPROXIMATION
// ---------------------------------------------------------------------------
// The Hijri year is ~354.37 days (lunar), so Hijri years drift ~1 year every
// 33 Gregorian years relative to 622 CE (the Hijra). The classic approximation:
//
//   AH = (CE - 622) * 33 / 32          CE = AH * 32 / 33 + 622
//
// This is accurate to ±1 year across the historically relevant range, which is
// exactly the precision our schema stores. All Hijri output is therefore
// displayed with an "AH" label and treated as approximate — day-level
// conversion (Umm al-Qura, etc.) is deliberately out of scope for v1.

/** Approximate Hijri year for a CE year. Only meaningful for years >= 622 CE. */
export function toHijriYear(ceYear: number): number {
  if (!Number.isInteger(ceYear)) {
    throw new RangeError(`toHijriYear() expects an integer, got ${ceYear}`);
  }
  if (ceYear < 622) {
    throw new RangeError(
      `toHijriYear() is only defined for years >= 622 CE, got ${ceYear}`,
    );
  }
  return Math.max(1, Math.floor(((ceYear - 622) * 33) / 32) + 1);
}

/** Approximate CE year for a Hijri year. */
export function fromHijriYear(hijriYear: number): number {
  if (!Number.isInteger(hijriYear) || hijriYear < 1) {
    throw new RangeError(
      `fromHijriYear() expects a positive integer, got ${hijriYear}`,
    );
  }
  return Math.floor(((hijriYear - 1) * 32) / 33) + 622;
}

/**
 * Dual-calendar display for the Islamic-history lens.
 *   formatYearDual(750) -> "750 CE / 133 AH"
 * Falls back to plain formatting for pre-Hijra years.
 */
export function formatYearDual(astro: number): string {
  if (astro < 622) return formatYear(astro);
  return `${formatYear(astro)} / ${toHijriYear(astro)} AH`;
}
