/**
 * Song dynasty — succeeds the Tang in the East Asia lane (with the interregnum
 * honestly left as a gap, not papered over), and its fall closes against the
 * Mongol lane.
 */

import type { SpineModule } from "./types";

export const song: SpineModule = {
  periods: [
    {
      id: "song-dynasty",
      name: "Song Dynasty",
      kind: "dynasty",
      startYear: 960,
      endYear: 1279,
      region: "east-asia",
      parentId: "tang-dynasty", // succession across the Five Dynasties gap
      importance: 1,
      summary:
        "An economic and technological high-water mark of the pre-modern world: paper money, movable-type printing, the magnetic compass at sea, and cities of a million — ended by the Mongol conquest.",
      wikidataQid: "Q7462",
      centerLat: 34.79,
      centerLng: 114.31, // Kaifeng
      influenceKm: 2000,
    },
  ],
  people: [
    {
      id: "shen-kuo",
      name: "Shen Kuo",
      birthYear: 1031,
      deathYear: 1095,
      importance: 2,
      influence:
        "Song polymath whose Dream Pool Essays described the magnetic compass, movable type, and true north — a one-man record of his civilization's technical genius.",
      wikidataQid: "Q205921",
      lat: 34.79,
      lng: 114.31,
      place: "Kaifeng",
      periods: [{ periodId: "song-dynasty", role: "scholar" }],
    },
    {
      id: "su-shi",
      name: "Su Shi",
      birthYear: 1037,
      deathYear: 1101,
      importance: 2,
      influence:
        "Poet, painter, and statesman — the complete Song literatus.",
      lat: 30.25,
      lng: 120.17,
      place: "Hangzhou", // of his many postings, the one he shaped most
      periods: [{ periodId: "song-dynasty", role: "artist" }],
    },
    {
      id: "zhu-xi",
      name: "Zhu Xi",
      birthYear: 1130,
      deathYear: 1200,
      importance: 2,
      influence:
        "Synthesized Neo-Confucianism; his canon became East Asia's civil-service orthodoxy for six hundred years.",
      lat: 27.33,
      lng: 118.03,
      place: "Wuyishan",
      periods: [{ periodId: "song-dynasty", role: "philosopher" }],
    },
  ],
  events: [
    {
      id: "fall-of-southern-song",
      name: "Fall of the Southern Song",
      startYear: 1279,
      region: "east-asia",
      importance: 2,
      summary:
        "The naval battle of Yamen ends Song resistance; Kublai Khan's Yuan dynasty rules all of China — the Mongol conquest complete after four decades of war.",
      lat: 22.4,
      lng: 113.1,
      periodIds: ["song-dynasty", "mongol-empire"],
    },
  ],
};
