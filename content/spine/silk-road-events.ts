/**
 * Silk Road events — a small events-only cluster module, plus the membership
 * declarations for the silk-road lens (the lens itself is defined centrally in
 * index.ts themeDefs; this module is its most-related home).
 */

import type { SpineModule } from "./types";

export const silkRoadEvents: SpineModule = {
  periods: [],

  // The lens only includes people genuinely tied to the road itself. Its
  // people arrived with the people-on-globe wave and are declared in their
  // home modules: Xuanzang (tang.ts), Marco Polo (abbasid.ts), Ibn Battuta
  // (delhi-sultanate.ts). Court figures (Shen Kuo et al.) still don't qualify.
  people: [],

  events: [
    {
      id: "marco-polo-journey",
      name: "Marco Polo's journey",
      startYear: 1271,
      endYear: 1295,
      region: "steppe-central-asia",
      importance: 2,
      lat: 39.65,
      lng: 66.97, // Samarkand, as emblem of the overland route
      summary:
        "A Venetian merchant family crosses Asia to Kublai Khan's court and returns by sea a quarter-century later — the Pax Mongolica briefly making the whole road passable end to end.",
      periodIds: ["mongol-empire"],
    },
  ],

  themeMemberships: {
    "silk-road": {
      periods: [
        "tang-dynasty",
        "song-dynasty",
        "abbasid-caliphate",
        "byzantine-empire",
        "mongol-empire",
      ],
      events: ["battle-of-talas", "marco-polo-journey"],
      // no people in v1 — see note above
    },
  },
};
