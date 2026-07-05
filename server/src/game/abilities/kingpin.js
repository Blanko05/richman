// H -- The Kingpin (characters.md).
//
// Passive: tracks every landing on his turf zone across all players, via
// Room's onLanding hook (fires for every property/transit/utility landing,
// regardless of ownership state) -- landingCount lives in H's own
// abilityState so Room.js stays agnostic of it. Every 3rd landing (a
// deterministic counter, not a chance roll) triggers a 90% bank-mediated cut
// -- but only when that specific landing actually produced rent (onRentPaid
// only fires when rent is owed); a 3rd landing on an unowned/mortgaged/
// self-owned tile still consumes the count, it just has nothing to cut.
//
// Active: Hostile Takeover seizes any one ownable tile (not already his) for
// the rest of the round -- see Room.revertHostileTakeover for the actual
// revert-at-round-end mechanics.
import { TILE_TYPES } from "../board.js";

const TURF_TILES = new Set([37, 38, 39, 41, 44, 45, 47]); // salmonLeft + tealLeft -- characters.md
const OWNABLE_TYPES = new Set([TILE_TYPES.PROPERTY, TILE_TYPES.TRANSIT, TILE_TYPES.UTILITY]);

export const kingpin = {
  id: "H",
  activeName: "Hostile Takeover",
  description: "Seizes control of any tile (owned or unowned, not already his) for the rest of the round, then it reverts.",
  passiveDescription: "Every 3rd landing on his turf (tiles 37/38/39/41/44/45/47) triggers a 90% cut of that landing's rent.",
  cooldownLabel: "7 turns",
  targetType: "tile",
  activeCooldown: 7,
  passives: {
    onLanding(room, { holder, tileId }) {
      if (!TURF_TILES.has(tileId)) return;
      holder.abilityState.landingCount = (holder.abilityState.landingCount || 0) + 1;
    },
    onRentPaid(room, { holder, ownerId, tileId, rent }) {
      if (!TURF_TILES.has(tileId)) return;
      if ((holder.abilityState.landingCount || 0) % 3 !== 0) return;
      room.bankMediatedCut(holder.id, Math.floor(rent * 0.9), ownerId);
    },
  },
  active(room, caster, { tileId } = {}) {
    const tile = room._board[tileId];
    if (!tile || !OWNABLE_TYPES.has(tile.type)) return { error: "Invalid target" };
    const current = room.ownership[tileId];
    if (current?.ownerId === caster.id) return { error: "You already control this tile" };
    if (current) {
      const prevOwner = room.playerById(current.ownerId);
      if (prevOwner) prevOwner.properties = prevOwner.properties.filter((id) => id !== tileId);
    }
    room.hostileTakeover = {
      tileId,
      previousOwnership: current ? { ...current } : null,
      roundPlaced: room.round,
    };
    room.ownership[tileId] = current ? { ...current, ownerId: caster.id } : { ownerId: caster.id, houses: 0 };
    if (!caster.properties.includes(tileId)) caster.properties.push(tileId);
    room.pushLog(`${caster.name} seized control of ${tile.name} for the rest of the round.`);
    return { ok: true, tileId };
  },
};
