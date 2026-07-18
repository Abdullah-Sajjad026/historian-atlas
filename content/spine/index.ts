/**
 * Spine registry. Add each new civilization module here; the seed script
 * iterates this list. Themes are defined once, centrally, because a lens
 * spans many modules.
 */

import type { SpineModule } from "./types";
import { islamicBookends } from "./islamic-bookends";
import { abbasid } from "./abbasid";
import { tang } from "./tang";
import { worldModules } from "./world";
import { cordoba } from "./cordoba";
import { mali } from "./mali";
import { song } from "./song";
import { carolingian } from "./carolingian";
import { inca } from "./inca";
import { habsburgSpain } from "./habsburg-spain";
import { maurya } from "./maurya";
import { delhiSultanate } from "./delhi-sultanate";
import { mughal } from "./mughal";
import { silkRoadEvents } from "./silk-road-events";

export const spineModules: SpineModule[] = [
  islamicBookends, // before abbasid: umayyad.parentId references rashidun
  abbasid,
  tang,
  worldModules,
  cordoba, // after abbasid: parentId references umayyad-caliphate
  mali,
  song,
  carolingian,
  habsburgSpain, // before inca: cajamarca links against it
  inca,
  maurya, // first BCE content; NOT gupta's parent (500-year gap ≠ succession)
  delhiSultanate, // before mughal: mughal-empire.parentId references it
  mughal,
  silkRoadEvents, // after tang/song/abbasid/world: silk-road lens references them
  // next: abbasid-cairo.ts, aztec.ts, ...
];

export interface ThemeDef {
  id: string;
  name: string;
  description: string;
  calendarMode: "gregorian" | "dual-hijri";
}

export const themeDefs: ThemeDef[] = [
  {
    id: "islamic-history",
    name: "Islamic History",
    description:
      "From the Rashidun through the Ottomans — caliphates, dynasties, scholars, and the world around them.",
    calendarMode: "dual-hijri",
  },
  {
    id: "silk-road",
    name: "The Silk Road",
    description:
      "The overland threads binding East Asia to the Mediterranean — the empires that guarded the routes, and what moved along them: silk, paper, faiths, and armies.",
    calendarMode: "gregorian",
  },
  {
    id: "subcontinent",
    name: "The Subcontinent",
    description:
      "South Asia from the Mauryas to the Mughals — the empires and sultanates of the subcontinent and the scholars who worked between them.",
    calendarMode: "gregorian",
  },
];
