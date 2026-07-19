/**
 * Abbasid Caliphate — first vertical slice of the spine.
 *
 * Chosen first because it exercises every hard part of the model at once:
 * a succession chain (parentId -> umayyad-caliphate, seeded as a stub),
 * a cross-period event (Siege of Baghdad touches Abbasids AND Mongols),
 * the dual-calendar theme lens, and Wikidata QIDs on every entity.
 */

import type { SpineModule } from "./types";

export const abbasid: SpineModule = {
  periods: [
    {
      // Stub predecessor so the succession chain resolves; gets its own full
      // module later. Stubs are legitimate spine entries at importance 2.
      id: "umayyad-caliphate",
      name: "Umayyad Caliphate",
      kind: "caliphate",
      startYear: 661,
      endYear: 750,
      parentId: "rashidun-caliphate",
      region: "mena",
      importance: 2,
      centerLat: 33.51,
      centerLng: 36.29, // Damascus
      influenceKm: 2600,
      summary:
        "First hereditary caliphate, ruling from Damascus. At its height the largest empire the world had yet seen, stretching from Iberia to the Indus.",
      wikidataQid: "Q8575586",
    },
    {
      id: "abbasid-caliphate",
      name: "Abbasid Caliphate",
      kind: "caliphate",
      startYear: 750,
      endYear: 1258,
      region: "mena",
      parentId: "umayyad-caliphate",
      importance: 1,
      centerLat: 33.31,
      centerLng: 44.36, // Baghdad
      influenceKm: 2300,
      summary:
        "Overthrew the Umayyads and moved the capital to Baghdad, presiding over the Islamic Golden Age — a flowering of science, philosophy, medicine, and translation that shaped both the Islamic world and, later, Europe.",
      wikidataQid: "Q12536",
    },
    {
      id: "mongol-empire",
      name: "Mongol Empire",
      kind: "empire",
      startYear: 1206,
      endYear: 1368,
      region: "steppe-central-asia",
      importance: 1,
      centerLat: 47.2,
      centerLng: 102.8, // Karakorum
      influenceKm: 3800,
      summary:
        "Largest contiguous land empire in history, founded by Genghis Khan. Its westward campaigns ended the Abbasid Caliphate at Baghdad in 1258.",
      wikidataQid: "Q12557",
    },
  ],

  people: [
    {
      id: "harun-al-rashid",
      name: "Harun al-Rashid",
      birthYear: 763,
      birthCertainty: "circa",
      deathYear: 809,
      importance: 2,
      influence:
        "Fifth Abbasid caliph whose reign marks the apex of the Islamic Golden Age; patron of the arts and the court immortalized in One Thousand and One Nights.",
      wikidataQid: "Q124074",
      lat: 33.31,
      lng: 44.36,
      place: "Baghdad",
      periods: [{ periodId: "abbasid-caliphate", role: "ruler" }],
    },
    {
      id: "al-mamun",
      name: "Al-Ma'mun",
      birthYear: 786,
      deathYear: 833,
      importance: 2,
      influence:
        "Caliph who institutionalized the translation movement, expanding the House of Wisdom into the era's greatest center of learning.",
      wikidataQid: "Q243610",
      lat: 33.31,
      lng: 44.36,
      place: "Baghdad",
      periods: [{ periodId: "abbasid-caliphate", role: "ruler" }],
    },
    {
      id: "al-khwarizmi",
      name: "Muhammad ibn Musa al-Khwarizmi",
      birthYear: 780,
      birthCertainty: "circa",
      deathYear: 850,
      deathCertainty: "circa",
      importance: 1,
      influence:
        "Mathematician at the House of Wisdom whose treatise on al-jabr founded algebra as a discipline; the word 'algorithm' derives from his name.",
      wikidataQid: "Q9038",
      lat: 33.31,
      lng: 44.36,
      place: "Baghdad",
      periods: [{ periodId: "abbasid-caliphate", role: "scholar" }],
    },
    {
      id: "al-razi",
      name: "Abu Bakr al-Razi",
      birthYear: 865,
      birthCertainty: "circa",
      deathYear: 925,
      importance: 2,
      influence:
        "Physician-philosopher whose clinical writings — including the first clear account distinguishing smallpox from measles — taught Europe medicine for centuries.",
      lat: 35.59,
      lng: 51.43,
      place: "Rayy",
      periods: [{ periodId: "abbasid-caliphate", role: "scholar" }],
    },
    {
      id: "al-ghazali",
      name: "Al-Ghazali",
      birthYear: 1058,
      deathYear: 1111,
      importance: 2,
      influence:
        "Taught at Baghdad's Nizamiyya; reshaped Islamic theology's relationship with philosophy and Sufism.",
      lat: 33.31,
      lng: 44.36,
      place: "Baghdad",
      periods: [
        { periodId: "abbasid-caliphate", role: "philosopher" },
        { periodId: "abbasid-caliphate", role: "scholar" },
      ],
    },
    {
      id: "genghis-khan",
      name: "Genghis Khan",
      birthYear: 1162,
      birthCertainty: "circa",
      deathYear: 1227,
      importance: 1,
      influence:
        "United the Mongol tribes and launched the conquests that created the largest contiguous empire in history, redrawing Eurasia's political map.",
      wikidataQid: "Q720",
      lat: 47.2,
      lng: 102.8,
      place: "Karakorum",
      periods: [{ periodId: "mongol-empire", role: "founder" }],
    },
    {
      id: "kublai-khan",
      name: "Kublai Khan",
      birthYear: 1215,
      deathYear: 1294,
      importance: 2,
      influence:
        "Genghis's grandson who completed the conquest of China and founded the Yuan, ruling the Mongol world from Khanbaliq.",
      wikidataQid: "Q7523", // best-effort — enrich tripwire verifies
      lat: 39.9,
      lng: 116.4,
      place: "Khanbaliq (Beijing)",
      periods: [{ periodId: "mongol-empire", role: "ruler" }],
    },
    {
      id: "marco-polo",
      name: "Marco Polo",
      birthYear: 1254,
      deathYear: 1324,
      importance: 2,
      influence:
        "Venetian merchant whose quarter-century journey to Kublai Khan's court gave Europe its most influential account of Asia.",
      wikidataQid: "Q6101", // best-effort — enrich tripwire verifies
      lat: 39.9,
      lng: 116.4,
      place: "Khanbaliq (Beijing)",
      periods: [{ periodId: "mongol-empire", role: "explorer" }],
    },
  ],

  events: [
    {
      id: "abbasid-revolution",
      name: "Abbasid Revolution",
      startYear: 747,
      endYear: 750,
      region: "mena",
      importance: 2,
      lat: 36.3,
      lng: 62.2, // Khurasan
      summary:
        "Uprising rising from Khurasan that overthrew the Umayyads and brought the Abbasid dynasty to power.",
      wikidataQid: "Q622074",
      periodIds: ["umayyad-caliphate", "abbasid-caliphate"],
    },
    {
      id: "founding-of-baghdad",
      name: "Founding of Baghdad",
      startYear: 762,
      region: "mena",
      importance: 2,
      lat: 33.31,
      lng: 44.36,
      summary:
        "Caliph al-Mansur founds the Round City on the Tigris; within a century it is among the largest and most learned cities on earth.",
      wikidataQid: "Q64489161",
      periodIds: ["abbasid-caliphate"],
    },
    {
      id: "siege-of-baghdad-1258",
      name: "Siege of Baghdad",
      startYear: 1258,
      region: "mena",
      importance: 1,
      lat: 33.31,
      lng: 44.36,
      summary:
        "Hulagu Khan's Mongol army sacks Baghdad, killing the last ruling Abbasid caliph and ending five centuries of the caliphate — the conventional close of the Islamic Golden Age.",
      wikidataQid: "Q639864",
      periodIds: ["abbasid-caliphate", "mongol-empire"],
    },
  ],

  themeMemberships: {
    "islamic-history": {
      periods: ["umayyad-caliphate", "abbasid-caliphate"],
      people: ["harun-al-rashid", "al-mamun", "al-khwarizmi", "al-razi", "al-ghazali"],
      events: [
        "abbasid-revolution",
        "founding-of-baghdad",
        "siege-of-baghdad-1258",
      ],
    },
    "silk-road": {
      // Marco Polo is the road's emblem — the journey event was already a
      // member; the traveler himself joins with the people-on-globe wave.
      people: ["marco-polo"],
    },
  },
};
