// Registry of selectable maps. Every map shares the exact same 32-tile skeleton
// (same TILE_TYPES/groups at each index) as the default board in ../board.js, so
// Room.js and the client's grid renderer work unchanged for any map in here.

import { BOARD as DEFAULT_BOARD } from "../board.js";
import { SURPRISE_CARDS as DEFAULT_SURPRISE, TREASURE_CARDS as DEFAULT_TREASURE } from "../cards.js";
import { BOARD as JORDAN_BOARD, SURPRISE_CARDS as JORDAN_SURPRISE, TREASURE_CARDS as JORDAN_TREASURE } from "./jordan.js";
import { BOARD as AMERICAN_BOARD, SURPRISE_CARDS as AMERICAN_SURPRISE, TREASURE_CARDS as AMERICAN_TREASURE } from "./american.js";
import {
  BOARD as CORPORATE_BOARD,
  SURPRISE_CARDS as CORPORATE_SURPRISE,
  TREASURE_CARDS as CORPORATE_TREASURE,
} from "./corporateLadder.js";
import { BOARD as LAND67_BOARD, SURPRISE_CARDS as LAND67_SURPRISE, TREASURE_CARDS as LAND67_TREASURE } from "./land67.js";

export const DEFAULT_MAP_ID = "default";

const MAPS = {
  [DEFAULT_MAP_ID]: {
    id: DEFAULT_MAP_ID,
    name: "Fortune City",
    board: DEFAULT_BOARD,
    surpriseCards: DEFAULT_SURPRISE,
    treasureCards: DEFAULT_TREASURE,
  },
  jordan: {
    id: "jordan",
    name: "Jordan",
    board: JORDAN_BOARD,
    surpriseCards: JORDAN_SURPRISE,
    treasureCards: JORDAN_TREASURE,
  },
  american: {
    id: "american",
    name: "American Dream",
    board: AMERICAN_BOARD,
    surpriseCards: AMERICAN_SURPRISE,
    treasureCards: AMERICAN_TREASURE,
  },
  corporate: {
    id: "corporate",
    name: "Corporate Ladder",
    board: CORPORATE_BOARD,
    surpriseCards: CORPORATE_SURPRISE,
    treasureCards: CORPORATE_TREASURE,
  },
  land67: {
    id: "land67",
    name: "بلد الستات والسبعات",
    board: LAND67_BOARD,
    surpriseCards: LAND67_SURPRISE,
    treasureCards: LAND67_TREASURE,
  },
};

export function resolveMap(mapId) {
  return MAPS[mapId] ?? MAPS[DEFAULT_MAP_ID];
}

export function listMaps() {
  return Object.values(MAPS).map(({ id, name }) => ({ id, name }));
}
