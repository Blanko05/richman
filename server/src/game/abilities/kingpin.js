// H -- The Kingpin (characters.md).
//
// Passive: tracks every landing on his turf zone across all players, via
// Room's onLanding hook (fires for every property/transit/utility landing,
// regardless of ownership state) -- landingCount lives in H's own
// abilityState so Room.js stays agnostic of it. Every 2nd landing (a
// deterministic counter, not a chance roll) triggers a 90% bank-mediated cut
// -- but only when that specific landing actually produced rent (onRentPaid
// only fires when rent is owed); a 2nd landing on an unowned/mortgaged/
// self-owned tile still consumes the count, it just has nothing to cut.
// Buffed from every 3rd landing (playtesting: H was the weakest character,
// this passive's payout was too rare to matter) -- user's call, a
// numbers-only tweak, not a new mechanic.
//
// Active: Hostile Takeover seizes any one ownable tile (not already his)
// until H's own next turn comes around (not a global round boundary --
// decisions.md; keeps the duration equally fair regardless of caster seat
// position) -- see Room.revertHostileTakeover for the actual revert
// mechanics. This is "control" (rent redirects to H, the tile is his color)
// rather than full ownership rights -- Room.buyHouse/sellHouse/
// mortgageProperty/unmortgageProperty all reject a tile currently under
// Hostile Takeover, seized-from side included. User's call: without this,
// a build/mortgage made during the seizure window would silently vanish
// (or hand the original owner an unexpected un-mortgage) the moment
// revertHostileTakeover restores its pre-seizure snapshot. Cooldown buffed
// from 6 turns to 4 (same balance pass as the passive above) so it's usable
// more often, not just a once-in-a-while swing.
import { TILE_TYPES } from "../board.js";

const TURF_TILES = new Set([37, 38, 39, 41, 44, 45, 47]); // salmonLeft + tealLeft -- characters.md
const OWNABLE_TYPES = new Set([TILE_TYPES.PROPERTY, TILE_TYPES.TRANSIT, TILE_TYPES.UTILITY]);

export const kingpin = {
  id: "H",
  activeName: "Hostile Takeover",
  description: "Seizes a tile -- owned or not. Reverts to its previous owner on his next turn.",
  passiveDescription: "Every 2nd landing on his turf triggers a 90% cut of that landing's rent.",
  cooldownLabel: "4 turns",
  targetType: "tile",
  activeCooldown: 4,
  passives: {
    onLanding(room, { holder, tileId }) {
      if (!TURF_TILES.has(tileId)) return;
      holder.abilityState.landingCount = (holder.abilityState.landingCount || 0) + 1;
    },
    onRentPaid(room, { holder, ownerId, tileId, rent }) {
      if (!TURF_TILES.has(tileId)) return;
      if ((holder.abilityState.landingCount || 0) % 2 !== 0) return;
      room.bankMediatedCut(holder.id, Math.floor(rent * 0.9), ownerId, "turf landing cut");
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
      casterId: caster.id,
    };
    room.ownership[tileId] = current ? { ...current, ownerId: caster.id } : { ownerId: caster.id, houses: 0 };
    if (!caster.properties.includes(tileId)) caster.properties.push(tileId);
    room.pushLog(`${caster.name} seized control of ${tile.name} until their own next turn.`);
    // Client-animation broadcast (abilities.md) -- cast and payoff are the
    // same synchronous moment here (no targeting-then-later-resolution gap
    // like Barricade/Curse), so one seq bump covers both, same pattern as
    // Detonate's own single-event pair.
    room.hostileTakeoverSeq = (room.hostileTakeoverSeq || 0) + 1;
    room.lastHostileTakeover = { casterId: caster.id, tileId, previousOwnerId: current?.ownerId ?? null };
    return { ok: true, tileId };
  },
};
