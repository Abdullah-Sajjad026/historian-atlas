/**
 * Delhi Sultanate — fills the south-asia lane's medieval gap and anchors the
 * Mughal succession chain (mughal-empire.parentId points here, so this module
 * must be registered BEFORE mughal.ts in index.ts).
 *
 * FUTURE-DEEPENING SEAM: the Sultanate was five successive dynasties (Mamluk,
 * Khalji, Tughlaq, Sayyid, Lodi) treated here as ONE period. If the lane ever
 * needs that depth, split them into child periods rather than widening this one.
 */

import type { SpineModule } from "./types";

export const delhiSultanate: SpineModule = {
  periods: [
    {
      id: "delhi-sultanate",
      name: "Delhi Sultanate",
      // kind "kingdom", not "era": this is a single sovereign state ruled from
      // one throne (whichever dynasty held it) — "era" is for civilizational
      // spans like Classic Maya, and the enum has no "sultanate".
      kind: "kingdom",
      startYear: 1206,
      endYear: 1526,
      region: "south-asia",
      importance: 2,
      centerLat: 28.65,
      centerLng: 77.23, // Delhi
      influenceKm: 1300,
      summary:
        "Three centuries of Muslim sultans ruling from Delhi across five successive dynasties, joining northern India to the wider Persianate and Islamic worlds and setting the stage for the Mughals.",
      // QID unverified until an enrich tripwire run.
    },
  ],

  people: [
    {
      id: "razia-sultana",
      name: "Razia Sultana",
      birthYear: 1205,
      birthCertainty: "circa",
      deathYear: 1240,
      importance: 2,
      influence:
        "The first and only woman to sit on the throne of Delhi, ruling in her own name against the nobility's opposition.",
      lat: 28.65,
      lng: 77.23,
      place: "Delhi",
      periods: [{ periodId: "delhi-sultanate", role: "ruler" }],
    },
    {
      id: "ibn-battuta",
      name: "Ibn Battuta",
      birthYear: 1304,
      deathYear: 1369,
      deathCertainty: "circa",
      importance: 1,
      influence:
        "Three decades and 120,000 kilometers of travels across the Islamic world and beyond; served years as a qadi in Delhi mid-journey.",
      wikidataQid: "Q7331", // best-effort — enrich tripwire verifies
      lat: 28.65,
      lng: 77.23,
      place: "Delhi",
      periods: [{ periodId: "delhi-sultanate", role: "explorer" }],
    },
  ],

  events: [
    {
      id: "timur-sacks-delhi",
      name: "Timur sacks Delhi",
      startYear: 1398,
      region: "south-asia",
      importance: 3,
      lat: 28.65,
      lng: 77.23,
      summary:
        "Timur's invasion culminates in the sack of Delhi, shattering Tughlaq authority — the Sultanate never fully recovers its former reach.",
      periodIds: ["delhi-sultanate"],
    },
  ],

  themeMemberships: {
    subcontinent: {
      periods: ["delhi-sultanate"],
      people: ["razia-sultana"],
      events: ["timur-sacks-delhi"],
    },
    "islamic-history": {
      periods: ["delhi-sultanate"],
      people: ["razia-sultana", "ibn-battuta"],
      events: ["timur-sacks-delhi"],
    },
    "silk-road": {
      // The road's other great traveler, counterpart to Marco Polo.
      people: ["ibn-battuta"],
    },
  },
};
