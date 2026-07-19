/**
 * Carolingian Empire — the second Europe-lane thread; its coronation event
 * gives the 800 CE time-slice a European anchor alongside Byzantium.
 */

import type { SpineModule } from "./types";

export const carolingian: SpineModule = {
  periods: [
    {
      id: "carolingian-empire",
      name: "Carolingian Empire",
      kind: "empire",
      startYear: 751,
      endYear: 887,
      region: "europe",
      importance: 2,
      summary:
        "Frankish empire that reunified much of Western Europe for the first time since Rome; Charlemagne's court sparked a revival of learning, and the empire's partition sketched the outlines of France and Germany.",
      wikidataQid: "Q146246",
      centerLat: 50.78,
      centerLng: 6.08, // Aachen
      influenceKm: 900,
    },
  ],
  people: [
    {
      id: "charlemagne",
      name: "Charlemagne",
      birthYear: 748,
      birthCertainty: "circa",
      deathYear: 814,
      importance: 1,
      influence:
        "King of the Franks and, from 800, emperor — the 'father of Europe' whose reign fused Roman, Christian, and Germanic inheritance into a new Western order.",
      wikidataQid: "Q3044",
      lat: 50.78,
      lng: 6.08,
      place: "Aachen",
      periods: [{ periodId: "carolingian-empire", role: "ruler" }],
    },
    {
      id: "alcuin",
      name: "Alcuin of York",
      birthYear: 735,
      birthCertainty: "circa",
      deathYear: 804,
      importance: 3,
      influence:
        "Architect of the Carolingian renaissance and its script reform.",
      lat: 50.78,
      lng: 6.08,
      place: "Aachen",
      periods: [{ periodId: "carolingian-empire", role: "scholar" }],
    },
  ],
  events: [
    {
      id: "coronation-of-charlemagne",
      name: "Coronation of Charlemagne",
      startYear: 800,
      region: "europe",
      importance: 2,
      summary:
        "On Christmas Day in Rome, Pope Leo III crowns Charlemagne emperor — the first in the West in three centuries, to Byzantium's lasting fury.",
      wikidataQid: "Q1358634",
      lat: 41.9,
      lng: 12.45, // Rome
      periodIds: ["carolingian-empire", "byzantine-empire"],
    },
  ],
};
