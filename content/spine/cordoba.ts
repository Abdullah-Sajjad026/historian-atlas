/**
 * Umayyads of Córdoba — al-Andalus. Deliberately in the EUROPE lane (the
 * taxonomy is geographic) while belonging to the islamic-history lens: the
 * first module that makes the lens span lanes. Succession: Abd al-Rahman I
 * was an Umayyad survivor of the Abbasid revolution, so parentId points at
 * umayyad-caliphate — a succession edge that crosses lanes.
 */

import type { SpineModule } from "./types";

export const cordoba: SpineModule = {
  periods: [
    {
      id: "umayyads-of-cordoba",
      name: "Umayyads of Córdoba",
      kind: "dynasty",
      startYear: 756,
      endYear: 1031,
      region: "europe",
      parentId: "umayyad-caliphate",
      importance: 2,
      summary:
        "Founded by an Umayyad prince who escaped the Abbasid revolution and crossed to Iberia; as emirate and then caliphate, Córdoba became one of the largest and most learned cities of the medieval West.",
      wikidataQid: "Q276813",
      centerLat: 37.88,
      centerLng: -4.78, // Córdoba
      influenceKm: 800,
    },
  ],
  people: [
    {
      id: "abd-al-rahman-iii",
      name: "Abd al-Rahman III",
      birthYear: 890,
      deathYear: 961,
      importance: 2,
      influence:
        "Proclaimed the Caliphate of Córdoba in 929, breaking with Baghdad; under him al-Andalus reached its political and cultural height.",
      wikidataQid: "Q182865",
      periods: [{ periodId: "umayyads-of-cordoba", role: "ruler" }],
    },
  ],
  events: [
    {
      id: "abd-al-rahman-crosses-to-iberia",
      name: "Abd al-Rahman I reaches Iberia",
      startYear: 755,
      region: "europe",
      importance: 3,
      summary:
        "The last Umayyad prince, hunted across North Africa after the Abbasid revolution, lands in Iberia — within a year he rules Córdoba.",
      lat: 36.13,
      lng: -5.45,
      periodIds: ["umayyads-of-cordoba", "abbasid-caliphate"],
    },
  ],
  themeMemberships: {
    "islamic-history": {
      periods: ["umayyads-of-cordoba"],
      people: ["abd-al-rahman-iii"],
      events: ["abd-al-rahman-crosses-to-iberia"],
    },
  },
};
