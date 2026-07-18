/**
 * Inca Empire — second Americas-lane thread, and the atlas's first collision
 * between hemispheres: Cajamarca links the Americas lane to Habsburg Spain
 * in the Europe lane — the atlas's first cross-hemisphere event edge.
 */

import type { SpineModule } from "./types";

export const inca: SpineModule = {
  periods: [
    {
      id: "inca-empire",
      name: "Inca Empire",
      kind: "empire",
      startYear: 1438,
      endYear: 1533,
      region: "americas",
      importance: 1,
      summary:
        "In under a century, the largest empire in the pre-Columbian Americas: ten million people bound by road, storehouse, and khipu along the spine of the Andes — until smallpox, civil war, and Pizarro arrived within a decade of each other.",
      wikidataQid: "Q28573",
      centerLat: -13.53,
      centerLng: -71.97, // Cusco
      influenceKm: 1500,
    },
  ],
  people: [
    {
      id: "pachacuti",
      name: "Pachacuti",
      birthYear: 1418,
      birthCertainty: "circa",
      deathYear: 1471,
      deathCertainty: "circa",
      importance: 2,
      influence:
        "The ruler who turned the Cusco polity into an empire — reorganizer of state, calendar, and capital, and traditionally the builder of Machu Picchu.",
      wikidataQid: "Q274441",
      periods: [{ periodId: "inca-empire", role: "ruler" }],
    },
  ],
  events: [
    {
      id: "cajamarca",
      name: "Ambush at Cajamarca",
      startYear: 1532,
      region: "americas",
      importance: 2,
      summary:
        "Pizarro's tiny force seizes the emperor Atahualpa in a single afternoon; a ransom of gold fills a room, and the Andes' great empire begins its fall.",
      wikidataQid: "Q736283",
      lat: -7.16,
      lng: -78.52,
      periodIds: ["inca-empire", "habsburg-spain"],
    },
  ],
};
