/**
 * Habsburg Spain — closes the Cajamarca link (see inca.ts), creating the
 * atlas's first cross-hemisphere event edge. Heartland is Iberia; the global
 * empire's reach is deliberately NOT drawn as one giant circle — spheres of
 * influence stay honest to heartlands (README invariant on borders).
 */

import type { SpineModule } from "./types";

export const habsburgSpain: SpineModule = {
  periods: [
    {
      id: "habsburg-spain",
      name: "Habsburg Spain",
      kind: "kingdom",
      startYear: 1516,
      endYear: 1700,
      region: "europe",
      importance: 2,
      summary:
        "Spain under the House of Habsburg: the first empire on which the sun never set, fed by American silver — and the power whose conquistadors ended the Inca and Aztec worlds within a generation.",
      wikidataQid: "Q717110",
      centerLat: 40.42,
      centerLng: -3.7, // Madrid
      influenceKm: 900,
    },
  ],
  people: [
    {
      id: "philip-ii-of-spain",
      name: "Philip II of Spain",
      birthYear: 1527,
      deathYear: 1598,
      importance: 2,
      influence:
        "Ruled the empire at its height from the Escorial — a bureaucrat-king governing four continents by paper, whose reign fixed Spain's golden age and began its overextension.",
      wikidataQid: "Q83229",
      lat: 40.59,
      lng: -4.15,
      place: "El Escorial",
      periods: [{ periodId: "habsburg-spain", role: "ruler" }],
    },
    {
      id: "cervantes",
      name: "Miguel de Cervantes",
      birthYear: 1547,
      deathYear: 1616,
      importance: 2,
      influence: "Don Quixote — the first modern novel.",
      wikidataQid: "Q5682", // best-effort — enrich tripwire verifies
      lat: 40.42,
      lng: -3.7,
      place: "Madrid",
      periods: [{ periodId: "habsburg-spain", role: "artist" }],
    },
  ],
  events: [],
};
