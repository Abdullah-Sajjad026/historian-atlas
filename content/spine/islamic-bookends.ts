/**
 * Islamic-history lens: the bookends. Rashidun roots the caliphate succession
 * chain (rashidun -> umayyad -> abbasid); the Ottomans extend the lens to
 * 1922. Also seeds the Hijra as a PERIOD-LESS event (empty periodIds) —
 * a deliberate exercise of that edge case in the content format.
 *
 * NOTE: register this module BEFORE abbasid in content/spine/index.ts, since
 * abbasid.ts sets umayyad.parentId = rashidun-caliphate (FK enforced).
 */

import type { SpineModule } from "./types";

export const islamicBookends: SpineModule = {
  periods: [
    {
      id: "rashidun-caliphate",
      name: "Rashidun Caliphate",
      kind: "caliphate",
      startYear: 632,
      endYear: 661,
      region: "mena",
      importance: 2,
      summary:
        "The first caliphate, led by the four 'rightly guided' successors of the Prophet Muhammad. In three decades it carried Islam from Arabia across the Levant, Egypt, and Persia.",
      wikidataQid: "Q12490",
      centerLat: 24.47,
      centerLng: 39.61, // Medina
      influenceKm: 2200,
    },
    {
      id: "ottoman-empire",
      name: "Ottoman Empire",
      kind: "empire",
      startYear: 1299,
      startCertainty: "circa",
      endYear: 1922,
      region: "mena",
      importance: 1,
      summary:
        "Six-century empire spanning Anatolia, the Balkans, the Levant, and North Africa; after 1453 its capital was Constantinople, and after 1517 its sultans claimed the caliphate.",
      wikidataQid: "Q12560",
      centerLat: 41.01,
      centerLng: 28.98, // Constantinople / Istanbul
      influenceKm: 2600,
    },
  ],

  people: [
    {
      id: "umar-ibn-al-khattab",
      name: "Umar ibn al-Khattab",
      birthYear: 584,
      birthCertainty: "circa",
      deathYear: 644,
      importance: 2,
      influence:
        "Second Rashidun caliph; under his rule the caliphate became an empire, with the conquests of the Levant, Egypt, and Persia and the founding institutions of Islamic governance.",
      wikidataQid: "Q8467",
      periods: [{ periodId: "rashidun-caliphate", role: "ruler" }],
    },
    {
      id: "mehmed-ii",
      name: "Mehmed II",
      birthYear: 1432,
      deathYear: 1481,
      importance: 2,
      influence:
        "'The Conqueror' — took Constantinople in 1453 at age 21, ending the Roman imperial line and refounding the city as the Ottoman capital.",
      wikidataQid: "Q34503",
      periods: [{ periodId: "ottoman-empire", role: "ruler" }],
    },
  ],

  events: [
    {
      id: "hijra",
      name: "The Hijra",
      startYear: 622,
      region: "mena",
      importance: 1,
      summary:
        "Muhammad's migration from Mecca to Medina — year one of the Islamic calendar and the founding moment of the Muslim community as a polity.",
      wikidataQid: "Q131270",
      lat: 24.47,
      lng: 39.61,
      periodIds: [], // predates every period in the atlas — deliberately unlinked
    },
  ],

  themeMemberships: {
    "islamic-history": {
      periods: ["rashidun-caliphate", "ottoman-empire"],
      people: ["umar-ibn-al-khattab", "mehmed-ii"],
      events: ["hijra"],
    },
  },
};
