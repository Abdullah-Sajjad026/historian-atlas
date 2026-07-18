/**
 * World modules: one civilization per remaining lane, so every region of the
 * globe and every timeline lane has at least one thread. Each is a stub-depth
 * entry (importance-2 period, 0–1 people, 1 event) to be deepened later.
 *
 * QIDs for Ghana and Gupta are best-effort — the enrichment script's label
 * check (labelLooksWrong) will flag them on first run if wrong.
 */

import type { SpineModule } from "./types";

export const worldModules: SpineModule = {
  periods: [
    {
      id: "byzantine-empire",
      name: "Byzantine Empire",
      kind: "empire",
      startYear: 330,
      endYear: 1453,
      region: "europe",
      importance: 1,
      summary:
        "The Roman Empire's continuation in the Greek East, ruled from Constantinople for over a millennium — preserver of Roman law and Greek learning, and the great counterpart to the caliphates on its eastern frontier.",
      wikidataQid: "Q12544",
      centerLat: 41.01,
      centerLng: 28.98, // Constantinople
      influenceKm: 1700,
    },
    {
      id: "gupta-empire",
      name: "Gupta Empire",
      kind: "empire",
      startYear: 320,
      startCertainty: "circa",
      endYear: 550,
      endCertainty: "circa",
      region: "south-asia",
      importance: 2,
      summary:
        "North Indian empire remembered as a classical golden age: decimal numerals with zero, landmark Sanskrit literature, and advances in astronomy and mathematics that traveled west through the Islamic world.",
      wikidataQid: "Q28211",
      centerLat: 25.61,
      centerLng: 85.14, // Pataliputra
      influenceKm: 1500,
    },
    {
      id: "ghana-empire",
      name: "Ghana Empire",
      kind: "empire",
      startYear: 700,
      startCertainty: "circa",
      endYear: 1240,
      endCertainty: "circa",
      region: "sub-saharan-africa",
      importance: 2,
      summary:
        "West African trading empire (Wagadu) grown rich on the trans-Saharan gold and salt trade; its rulers' wealth was legendary in the accounts of Arab geographers.",
      wikidataQid: "Q206789",
      centerLat: 15.77,
      centerLng: -8.0, // Koumbi Saleh
      influenceKm: 1100,
    },
    {
      id: "classic-maya",
      name: "Classic Maya",
      kind: "era",
      startYear: 250,
      startCertainty: "circa",
      endYear: 900,
      endCertainty: "circa",
      region: "americas",
      importance: 2,
      summary:
        "The apex of Maya civilization: city-states like Tikal and Calakmul, a full writing system, the Long Count calendar, and astronomy rivaling anything in the Old World — entirely without contact with it.",
      wikidataQid: "Q28567",
      centerLat: 17.22,
      centerLng: -89.62, // Tikal
      influenceKm: 800,
    },
  ],

  people: [
    {
      id: "justinian-i",
      name: "Justinian I",
      birthYear: 482,
      birthCertainty: "circa",
      deathYear: 565,
      importance: 2,
      influence:
        "Byzantine emperor whose codification of Roman law (the Corpus Juris Civilis) underlies most European legal systems, and whose Hagia Sophia redefined architecture.",
      wikidataQid: "Q41866",
      periods: [{ periodId: "byzantine-empire", role: "ruler" }],
    },
    {
      id: "aryabhata",
      name: "Aryabhata",
      birthYear: 476,
      deathYear: 550,
      importance: 2,
      influence:
        "Gupta-era mathematician-astronomer: place-value arithmetic, a remarkably accurate pi, and a rotating-Earth model — his work reached Baghdad in translation and shaped Islamic astronomy.",
      wikidataQid: "Q11359",
      periods: [{ periodId: "gupta-empire", role: "scholar" }],
    },
  ],

  events: [
    {
      id: "fall-of-constantinople",
      name: "Fall of Constantinople",
      startYear: 1453,
      region: "europe",
      importance: 1,
      summary:
        "Mehmed II's army breaches the Theodosian Walls; the last Roman emperor dies in the fighting. One empire ends and another gains its capital in a single day.",
      wikidataQid: "Q46083",
      lat: 41.01,
      lng: 28.98,
      periodIds: ["byzantine-empire", "ottoman-empire"], // cross-lane, cross-module
    },
    {
      id: "hagia-sophia-consecrated",
      name: "Hagia Sophia consecrated",
      startYear: 537,
      region: "europe",
      importance: 3,
      summary:
        "Justinian's great church is completed in under six years; for nearly a thousand years it remains the largest enclosed space on earth.",
      wikidataQid: "Q1621186",
      lat: 41.01,
      lng: 28.98,
      periodIds: ["byzantine-empire"],
    },
    {
      id: "tikal-calakmul-war",
      name: "Tikal defeats Calakmul",
      startYear: 695,
      region: "americas",
      importance: 3,
      summary:
        "Jasaw Chan K'awiil I of Tikal captures the lord of rival superpower Calakmul, reversing a century of eclipse — the great-power politics of the Classic Maya world.",
      lat: 17.22,
      lng: -89.62,
      periodIds: ["classic-maya"],
    },
  ],

  themeMemberships: {
    "islamic-history": {
      // The fall of Constantinople belongs to the Islamic lens too.
      events: ["fall-of-constantinople"],
    },
  },
};
