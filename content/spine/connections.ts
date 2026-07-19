/**
 * Connections — relationships between entities across the whole spine,
 * drawn as great-circle arcs on the globe.
 *
 * These live in one dedicated module (rather than scattered into the
 * modules that own their endpoints) because almost every link here CROSSES
 * modules — that is the point of a connection. A link that ever belongs
 * clearly to a single module's story can live there instead; the seed
 * collects links from every module and upserts them after all entities.
 *
 * Endpoint refs are resolved by the seed lint (dangling id = loud failure)
 * but are not DB foreign keys, so this module's position in index.ts does
 * not matter for ordering.
 */

import type { SpineModule } from "./types";

export const connections: SpineModule = {
  periods: [],
  people: [],
  events: [],

  links: [
    {
      id: "embassy-harun-charlemagne",
      kind: "embassy",
      a: { type: "person", id: "harun-al-rashid" },
      b: { type: "person", id: "charlemagne" },
      startYear: 797,
      endYear: 807,
      importance: 1,
      summary:
        "Embassies exchanged between Baghdad and Aachen; the elephant Abul-Abbas reached Charlemagne's court in 802.",
    },
    {
      id: "war-talas-751",
      kind: "war",
      a: { type: "period", id: "tang-dynasty" },
      b: { type: "period", id: "abbasid-caliphate" },
      startYear: 751, // point link — a single clash, not a sustained war
      importance: 2,
      summary:
        "The armies meet on the Talas — the only major clash of the two empires.",
    },
    {
      id: "war-constantinople-1453",
      kind: "war",
      a: { type: "period", id: "byzantine-empire" },
      b: { type: "period", id: "ottoman-empire" },
      startYear: 1453,
      importance: 1,
      summary:
        "Mehmed II takes the city; one empire ends, another gains its capital.",
    },
    {
      id: "trade-saharan-gold",
      kind: "trade",
      a: { type: "period", id: "ghana-empire" },
      b: { type: "period", id: "umayyads-of-cordoba" },
      startYear: 900,
      endYear: 1031,
      certainty: "circa",
      importance: 2,
      summary:
        "West African gold crosses the Sahara to mint the coinage of al-Andalus.",
    },
    {
      // The link year (c. 773) is OUTSIDE the Gupta Empire's lifetime
      // (†c. 550) — legal and deliberate: a transmission outlives its
      // transmitters. Endpoints resolve to heartlands regardless of whether
      // the endpoint entity is alive at the link's years.
      id: "transmission-indian-numerals",
      kind: "transmission",
      a: { type: "period", id: "gupta-empire" },
      b: { type: "period", id: "abbasid-caliphate" },
      startYear: 773,
      certainty: "circa",
      importance: 2,
      summary:
        "Indian astronomical texts and numerals reach Baghdad; through al-Khwarizmi they become the world's digits.",
    },
    {
      id: "journey-xuanzang",
      kind: "journey",
      a: { type: "person", id: "xuanzang" },
      b: { lat: 25.14, lng: 85.44, label: "Nalanda" },
      startYear: 629,
      endYear: 645,
      importance: 2,
      summary:
        "Seventeen years overland to India's great monastery and back, carrying a library home to Chang'an.",
    },

    // Ibn Battuta's travels — three hops sharing one groupId, so the side
    // panel collapses them into a single journey whose endpoints change as
    // the year scrubs. Shared theme: three decades, 120,000 km.
    {
      id: "journey-ibn-battuta-hop1",
      kind: "journey",
      a: { lat: 35.78, lng: -5.81, label: "Tangier" },
      b: { lat: 21.39, lng: 39.86, label: "Mecca" },
      startYear: 1325,
      endYear: 1326,
      importance: 2,
      groupId: "ibn-battuta-travels",
      summary:
        "Three decades and 120,000 km begin: a young pilgrim leaves Tangier for Mecca.",
    },
    {
      id: "journey-ibn-battuta-hop2",
      kind: "journey",
      a: { lat: 21.39, lng: 39.86, label: "Mecca" },
      b: { type: "person", id: "ibn-battuta" }, // resolves to Delhi, his longest post
      startYear: 1326,
      endYear: 1334,
      importance: 2,
      groupId: "ibn-battuta-travels",
      summary:
        "Three decades, 120,000 km: east through Persia and Arabia to the qadi's bench in Delhi.",
    },
    {
      id: "journey-ibn-battuta-hop3",
      kind: "journey",
      a: { type: "person", id: "ibn-battuta" },
      b: { lat: 39.9, lng: 116.4, label: "Khanbaliq" },
      startYear: 1345,
      certainty: "circa",
      importance: 2,
      groupId: "ibn-battuta-travels",
      summary:
        "Three decades, 120,000 km: the farthest reach — from Delhi to the Yuan court at Khanbaliq.",
    },
  ],
};
