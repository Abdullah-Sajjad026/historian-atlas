/**
 * Mali Empire — deepens the sub-Saharan lane and the Islamic lens, and
 * Mansa Musa's hajj is the atlas's best cross-lane event: a West African
 * emperor's journey flaring in the MENA lane.
 */

import type { SpineModule } from "./types";

export const mali: SpineModule = {
  periods: [
    {
      id: "mali-empire",
      name: "Mali Empire",
      kind: "empire",
      startYear: 1226,
      startCertainty: "circa",
      endYear: 1670,
      endCertainty: "circa",
      region: "sub-saharan-africa",
      importance: 2,
      summary:
        "Successor to Ghana on the Niger, controlling the gold and salt trade at continental scale; its wealth under Mansa Musa entered world legend, and Timbuktu grew into a center of Islamic scholarship.",
      wikidataQid: "Q188696",
      centerLat: 11.38,
      centerLng: -8.4, // Niani
      influenceKm: 1300,
    },
  ],
  people: [
    {
      id: "mansa-musa",
      name: "Mansa Musa",
      birthYear: 1280,
      birthCertainty: "circa",
      deathYear: 1337,
      deathCertainty: "circa",
      importance: 1,
      influence:
        "Emperor of Mali, often cited as the wealthiest individual in history; his 1324 pilgrimage to Mecca distributed so much gold it reportedly depressed prices in Cairo for years.",
      wikidataQid: "Q309372",
      periods: [{ periodId: "mali-empire", role: "ruler" }],
    },
  ],
  events: [
    {
      id: "mansa-musa-hajj",
      name: "Mansa Musa's hajj",
      startYear: 1324,
      endYear: 1325,
      region: "mena",
      importance: 2,
      summary:
        "The emperor of Mali crosses the Sahara with a caravan of thousands, spending and gifting gold through Cairo on the way to Mecca — West Africa announcing itself to the wider world.",
      lat: 30.04,
      lng: 31.24, // Cairo
      periodIds: ["mali-empire"],
    },
  ],
  themeMemberships: {
    "islamic-history": {
      periods: ["mali-empire"],
      people: ["mansa-musa"],
      events: ["mansa-musa-hajj"],
    },
  },
};
