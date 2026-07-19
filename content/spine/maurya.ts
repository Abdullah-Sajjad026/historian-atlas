/**
 * Maurya Empire — the atlas's FIRST BCE content. Every pre-CE year goes
 * through bce() from src/lib/dates.ts so intent survives review (invariant:
 * astronomical integers in storage, never raw negatives in content).
 *
 * Deliberately NOT linked as gupta-empire's parent: the ~500-year gap between
 * Maurya collapse (c. 184 BCE) and Gupta rise (c. 320 CE) is not a
 * succession — parentId means "succeeded", not "same heartland later".
 */

import { bce } from "@/lib/dates";
import type { SpineModule } from "./types";

export const maurya: SpineModule = {
  periods: [
    {
      id: "maurya-empire",
      name: "Maurya Empire",
      kind: "empire",
      startYear: bce(322),
      endYear: bce(184),
      startCertainty: "circa",
      endCertainty: "circa",
      region: "south-asia",
      importance: 2,
      centerLat: 25.61,
      centerLng: 85.14, // Pataliputra
      influenceKm: 1600,
      summary:
        "First empire to unify most of the Indian subcontinent, ruled from Pataliputra. Ashoka's rock and pillar edicts are among the earliest surviving Indian writing, and his state patronage spread Buddhism along the trade routes of Asia.",
      // QID unverified until an enrich tripwire run.
    },
  ],

  people: [
    {
      id: "chandragupta-maurya",
      name: "Chandragupta Maurya",
      birthYear: bce(350),
      birthCertainty: "circa",
      deathYear: bce(295),
      deathCertainty: "circa",
      importance: 2,
      influence:
        "Founder of the Maurya Empire, who overthrew the Nanda dynasty and pushed back Alexander's successors to unify northern India for the first time.",
      lat: 25.61,
      lng: 85.14,
      place: "Pataliputra",
      periods: [{ periodId: "maurya-empire", role: "founder" }],
    },
    {
      id: "ashoka",
      name: "Ashoka",
      birthYear: bce(304),
      birthCertainty: "circa",
      deathYear: bce(232),
      importance: 1,
      influence:
        "Mauryan emperor who conquered Kalinga, renounced conquest in remorse, and spread Buddhism across Asia through edicts and missions — turning a regional faith into a world religion.",
      wikidataQid: "Q8589", // best-effort; unverified until an enrich run
      lat: 25.61,
      lng: 85.14,
      place: "Pataliputra",
      periods: [{ periodId: "maurya-empire", role: "ruler" }],
    },
  ],

  events: [
    {
      id: "kalinga-war",
      name: "Kalinga War",
      startYear: bce(261),
      certainty: "circa",
      region: "south-asia",
      importance: 2,
      lat: 20.27,
      lng: 85.83,
      summary:
        "Ashoka's conquest of Kalinga, whose carnage — recorded in his own edicts — turned him from conquest toward Buddhism and rule by dhamma.",
      periodIds: ["maurya-empire"],
    },
  ],

  themeMemberships: {
    subcontinent: {
      periods: ["maurya-empire"],
      people: ["chandragupta-maurya", "ashoka"],
      events: ["kalinga-war"],
    },
  },
};
