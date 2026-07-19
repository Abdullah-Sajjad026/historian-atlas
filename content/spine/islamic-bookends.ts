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
      lat: 24.47,
      lng: 39.61,
      place: "Medina",
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
      lat: 41.01,
      lng: 28.98,
      place: "Constantinople",
      periods: [{ periodId: "ottoman-empire", role: "ruler" }],
    },
    {
      id: "ali-ibn-abi-talib",
      name: "Ali ibn Abi Talib",
      birthYear: 601,
      birthCertainty: "circa",
      deathYear: 661,
      importance: 1,
      influence:
        "Fourth Rashidun caliph, foundational to both Sunni and Shia tradition.",
      lat: 31.99,
      lng: 44.33,
      place: "Kufa",
      periods: [{ periodId: "rashidun-caliphate", role: "ruler" }],
    },
    {
      id: "khalid-ibn-al-walid",
      name: "Khalid ibn al-Walid",
      birthYear: 585,
      birthCertainty: "circa",
      deathYear: 642,
      importance: 2,
      influence:
        "Undefeated commander of the early Islamic conquests.",
      lat: 33.51,
      lng: 36.29,
      place: "Damascus",
      periods: [{ periodId: "rashidun-caliphate", role: "general" }],
    },
    {
      id: "suleiman-the-magnificent",
      name: "Suleiman I",
      birthYear: 1494,
      deathYear: 1566,
      importance: 1,
      influence:
        "'The Magnificent' to Europe, 'the Lawgiver' to his own tradition — the Ottoman Empire at its zenith.",
      wikidataQid: "Q7987", // best-effort — enrich tripwire verifies
      lat: 41.01,
      lng: 28.98,
      place: "Constantinople",
      periods: [{ periodId: "ottoman-empire", role: "ruler" }],
    },
    {
      id: "mimar-sinan",
      name: "Mimar Sinan",
      birthYear: 1488,
      birthCertainty: "circa",
      deathYear: 1588,
      importance: 2,
      influence:
        "Chief Ottoman architect for half a century; the Süleymaniye and Selimiye are his.",
      lat: 41.01,
      lng: 28.98,
      place: "Constantinople",
      periods: [{ periodId: "ottoman-empire", role: "artist" }],
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
      people: [
        "umar-ibn-al-khattab",
        "mehmed-ii",
        "ali-ibn-abi-talib",
        "khalid-ibn-al-walid",
        "suleiman-the-magnificent",
        "mimar-sinan",
      ],
      events: ["hijra"],
    },
  },
};
