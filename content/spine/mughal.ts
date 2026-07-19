/**
 * Mughal Empire — succeeds the Delhi Sultanate (a REAL succession: Babur took
 * Delhi from the last Lodi sultan at Panipat in 1526), so parentId points at
 * delhi-sultanate and this module must be registered AFTER delhi-sultanate.ts
 * in index.ts (FK ordering; seed is per-module two-pass, not global).
 */

import type { SpineModule } from "./types";

export const mughal: SpineModule = {
  periods: [
    {
      id: "mughal-empire",
      name: "Mughal Empire",
      kind: "empire",
      startYear: 1526,
      endYear: 1857,
      region: "south-asia",
      parentId: "delhi-sultanate",
      importance: 1,
      centerLat: 27.18,
      centerLng: 78.02, // Agra
      influenceKm: 1500,
      summary:
        "The great early-modern empire of the subcontinent, at its height ruling most of South Asia and among the richest states on earth — Persianate high culture, monumental architecture, and an administrative machine the British later inherited.",
      wikidataQid: "Q33296", // best-effort; unverified until an enrich run
    },
  ],

  people: [
    {
      id: "akbar",
      name: "Akbar",
      birthYear: 1542,
      deathYear: 1605,
      importance: 1,
      influence:
        "Expanded Mughal rule across most of the subcontinent and bound it together with a policy of religious pluralism — abolishing the jizya, marrying Rajput houses into the dynasty, and floating his own syncretic Din-i Ilahi.",
      wikidataQid: "Q8597", // best-effort; unverified until an enrich run
      lat: 27.18,
      lng: 78.02,
      place: "Agra",
      periods: [{ periodId: "mughal-empire", role: "ruler" }],
    },
    {
      id: "aurangzeb",
      name: "Aurangzeb",
      birthYear: 1618,
      deathYear: 1707,
      importance: 2,
      influence:
        "Pushed the empire to its greatest territorial extent; his decades of Deccan warfare and stricter religious policy left it overstretched at his death.",
      lat: 28.65,
      lng: 77.23,
      place: "Delhi",
      periods: [{ periodId: "mughal-empire", role: "ruler" }],
    },
  ],

  events: [
    {
      id: "first-battle-of-panipat",
      name: "First Battle of Panipat",
      startYear: 1526,
      region: "south-asia",
      importance: 2,
      lat: 29.39,
      lng: 76.97,
      summary:
        "Babur's field guns break the last Lodi sultan's army at Panipat; the Delhi Sultanate ends and the Mughal Empire begins on the same day.",
      periodIds: ["delhi-sultanate", "mughal-empire"], // cross-period succession battle
    },
    {
      id: "taj-mahal-completed",
      name: "Taj Mahal completed",
      startYear: 1653,
      certainty: "circa",
      region: "south-asia",
      importance: 3,
      lat: 27.175,
      lng: 78.042,
      summary:
        "Shah Jahan's marble mausoleum for Mumtaz Mahal is finished at Agra after some two decades of work — the empire's architectural high-water mark.",
      periodIds: ["mughal-empire"],
    },
  ],

  themeMemberships: {
    subcontinent: {
      periods: ["mughal-empire"],
      people: ["akbar", "aurangzeb"],
      events: ["first-battle-of-panipat", "taj-mahal-completed"],
    },
    "islamic-history": {
      periods: ["mughal-empire"],
      people: ["akbar", "aurangzeb"],
      events: ["first-battle-of-panipat", "taj-mahal-completed"],
    },
  },
};
