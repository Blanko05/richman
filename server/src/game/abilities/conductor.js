// SD -- The Conductor (characters.md).
//
// Passive (station toll): if SD owns the station landed on, the payer's rent
// is doubled (via Room's modifyRent hook, applied inside calcRent itself, so
// every caller -- including tests calling calcRent directly -- sees the real
// final rent). If SD doesn't own it (owned by someone else, or unowned),
// the landing player pays SD a flat $50 directly, in addition to whatever
// rent the actual owner is separately owed -- fires on every station landing
// via the same onLanding hook H's landing counter uses, so it applies even
// when the station is unowned (no rent event at all, just this toll).
//
// Active: Wrecking Tour starts a bus from SD's current position and travels
// forward (wrapping the board loop if needed) until it reaches tile 6 (the
// Coster Station), demolishing up to 2 building levels on every property tile
// along the way -- including SD's own, if any fall on the path; this isn't a
// targeted ability, so the no-self-targeting rule doesn't come into it (see
// decisions.md). SD actually ends the tour AT tile 6 -- his position updates
// and the tile's normal landing effects resolve (rent, or an unowned-station
// buy prompt), the same shape as a card's "advanceTo" effect. Since abilities
// aren't turn-gated, this refuses to run while ANY pendingAction is already
// open (not just SD's) -- resolveTile could otherwise clobber someone else's
// in-progress decision (e.g. their own unresolved buy prompt).
import { TILE_TYPES, TOTAL_TILES } from "../board.js";

const STATION_TOLL = 50;
const LEVELS_PER_STOP = 2;
const TOUR_DESTINATION_TILE = 6;

export const conductor = {
  id: "SD",
  activeName: "Wrecking Tour",
  description: "Sends a bus from his current position to tile 6 (Coster Station), destroying up to 2 building levels on every property it passes.",
  passiveDescription: "Doubles rent on stations he owns; charges a flat $50 toll on any station he doesn't own.",
  cooldownLabel: "8 turns",
  targetType: "none",
  activeCooldown: 8,
  passives: {
    onLanding(room, { holder, playerId, tileId }) {
      const tile = room._board[tileId];
      if (tile.type !== TILE_TYPES.TRANSIT) return;
      const owned = room.ownership[tileId];
      if (owned?.ownerId === holder.id) return; // SD owns it -- doubled rent alone applies, no separate toll
      room.settleEarning(holder.id, () => room.transferMoney(playerId, holder.id, STATION_TOLL));
    },
  },
  modifyRent(room, { tile, owned, rent, holder }) {
    if (tile.type === TILE_TYPES.TRANSIT && owned.ownerId === holder.id) return rent * 2;
    return rent;
  },
  active(room, caster) {
    if (room.pendingAction) return { error: "Resolve the current action first" };
    const startTileId = caster.position;
    const path = [];
    let pos = (startTileId + 1) % TOTAL_TILES;
    for (let i = 0; i < TOTAL_TILES; i++) {
      path.push(pos);
      if (pos === TOUR_DESTINATION_TILE) break;
      pos = (pos + 1) % TOTAL_TILES;
    }
    let totalLevelsRemoved = 0;
    const demolished = [];
    for (const tileId of path) {
      const tile = room._board[tileId];
      if (tile.type !== TILE_TYPES.PROPERTY) continue;
      const owned = room.ownership[tileId];
      if (!owned || !owned.houses) continue;
      const levelsRemoved = Math.min(LEVELS_PER_STOP, owned.houses);
      owned.houses -= levelsRemoved;
      totalLevelsRemoved += levelsRemoved;
      demolished.push({ tileId, levelsRemoved });
      room.triggerPassive("onDemolish", { player: room.playerById(owned.ownerId), tileId, levelsRemoved });
    }
    room.pushLog(`${caster.name}'s Wrecking Tour passed ${path.length} tile(s), destroying ${totalLevelsRemoved} building level(s).`);
    caster.position = TOUR_DESTINATION_TILE;
    room.resolveTile(caster);
    // Room-wide animation signal (decisions.md): the ability's own return
    // value only ever reaches the caster's own ack, never the rest of the
    // room, so this is what lets every client animate the bus travelling
    // startTileId -> destination, and reveal exactly which tiles it hit.
    room.wreckingTourSeq += 1;
    room.lastWreckingTour = { casterId: caster.id, startTileId, path, demolished };
    return { ok: true, tilesPassed: path.length, totalLevelsRemoved };
  },
};
