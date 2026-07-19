/**
 * Tang dynasty — second vertical slice, and the pressure test for the format:
 * a non-Islamic civilization in a different lane, overlapping the Abbasids in
 * time. With this module seeded, every Abbasid-era Meanwhile rail lights up
 * with East Asia — the product thesis becomes visible.
 *
 * Also exercises: an event linking two periods across LANES (Battle of Talas
 * touches both the Tang and Abbasid worlds), and a person with a disputed
 * birth year (Wu Zetian's is contested between 623 and 625).
 */

import type { SpineModule } from "./types";

export const tang: SpineModule = {
  periods: [
    {
      id: "tang-dynasty",
      name: "Tang Dynasty",
      kind: "dynasty",
      startYear: 618,
      endYear: 907,
      region: "east-asia",
      importance: 1,
      centerLat: 34.34,
      centerLng: 108.94, // Chang'an
      influenceKm: 2400,
      summary:
        "Often regarded as a golden age of Chinese civilization: a cosmopolitan empire centered on Chang'an — then the largest city in the world — with flourishing poetry, Silk Road trade, and state institutions later imitated across East Asia.",
      wikidataQid: "Q9683",
    },
  ],

  people: [
    {
      id: "emperor-taizong",
      name: "Emperor Taizong of Tang",
      birthYear: 598,
      deathYear: 649,
      importance: 2,
      influence:
        "Co-founder and second emperor of the Tang; his reign (the 'Zhenguan era') became the classical Chinese model of good governance.",
      wikidataQid: "Q9701",
      lat: 34.34,
      lng: 108.94,
      place: "Chang'an",
      periods: [{ periodId: "tang-dynasty", role: "ruler" }],
    },
    {
      id: "wu-zetian",
      name: "Wu Zetian",
      birthYear: 624,
      birthCertainty: "disputed",
      deathYear: 705,
      importance: 2,
      influence:
        "The only woman to rule China as emperor in her own right; expanded the examination system and the empire's reach into Central Asia.",
      wikidataQid: "Q9702",
      lat: 34.62,
      lng: 112.45,
      place: "Luoyang",
      periods: [{ periodId: "tang-dynasty", role: "ruler" }],
    },
    {
      id: "du-fu",
      name: "Du Fu",
      birthYear: 712,
      deathYear: 770,
      importance: 2,
      influence:
        "Widely considered China's greatest poet; his verse chronicling the An Lushan rebellion fused personal witness with history itself.",
      wikidataQid: "Q36014",
      lat: 34.34,
      lng: 108.94,
      place: "Chang'an",
      periods: [{ periodId: "tang-dynasty", role: "artist" }],
    },
    {
      id: "li-bai",
      name: "Li Bai",
      birthYear: 701,
      deathYear: 762,
      importance: 2,
      influence:
        "One of the two great Tang poets — the romantic voice of Chinese literature.",
      lat: 34.34,
      lng: 108.94,
      place: "Chang'an",
      periods: [{ periodId: "tang-dynasty", role: "artist" }],
    },
    {
      id: "xuanzang",
      name: "Xuanzang",
      birthYear: 602,
      deathYear: 664,
      importance: 2,
      influence:
        "Seventeen-year overland journey to India; his translations and travel record shaped Buddhism and Silk Road geography.",
      lat: 34.34,
      lng: 108.94,
      place: "Chang'an",
      periods: [
        { periodId: "tang-dynasty", role: "explorer" },
        { periodId: "tang-dynasty", role: "scholar" },
      ],
    },
  ],

  events: [
    {
      id: "battle-of-talas",
      name: "Battle of Talas",
      startYear: 751,
      region: "steppe-central-asia",
      importance: 2,
      lat: 42.53,
      lng: 72.24, // Talas river valley
      summary:
        "Abbasid and Tang armies meet in Central Asia — the only major clash between the two empires. Tang defeat helps fix the cultural boundary of Central Asia, and captured artisans are traditionally credited with carrying papermaking westward.",
      wikidataQid: "Q706342",
      periodIds: ["tang-dynasty", "abbasid-caliphate"],
    },
    {
      id: "an-lushan-rebellion",
      name: "An Lushan Rebellion",
      startYear: 755,
      endYear: 763,
      region: "east-asia",
      importance: 1,
      lat: 34.34,
      lng: 108.94,
      summary:
        "Catastrophic revolt that broke Tang central power; among the deadliest conflicts of the pre-modern world and the hinge of the dynasty's decline.",
      wikidataQid: "Q567097",
      periodIds: ["tang-dynasty"],
    },
  ],

  themeMemberships: {
    "silk-road": {
      // Xuanzang traveled the road itself — the lens's first Tang person.
      people: ["xuanzang"],
    },
  },
};
