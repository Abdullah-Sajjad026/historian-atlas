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
  // next: abbasid-cairo.ts, delhi-sultanate.ts, aztec.ts, ...
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
];
