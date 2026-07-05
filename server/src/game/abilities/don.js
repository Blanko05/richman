// D -- The Don (characters.md).
//
// Passive: 30% bank-mediated cut of rent collected on his turf zone
// (deducted from the property owner -- if D owns the tile himself, owner
// and holder are the same player, so the add/subtract nets to zero and D
// simply keeps the full rent as owner, no double-dip); 50% bank-mediated cut
// of any tax payment anywhere (bank absorbs -- tax has no player "earner" to
// deduct from). Percentage cuts round down, same floor-biased convention
// Room.js already uses for house-sale refunds/mortgage values.
//
// Active: Barricade places a wall that's a one-shot trap, not a lasting wall
// -- it catches only the FIRST player whose forward movement crosses it that
// round, then deactivates immediately (or expires unused at round end). See
// Room.applyBarricade for the actual movement-interception math (forward
// movement only; decisions.md).
const TURF_TILES = new Set([13, 14, 16]); // salmonRight -- characters.md

export const don = {
  id: "D",
  activeName: "Barricade",
  description: "Places a wall on a chosen tile -- traps the first player whose forward movement carries them past it, stopping them there instead, then deactivates.",
  passiveDescription: "Takes a 30% cut of rent collected on his turf (tiles 13/14/16) and 50% of every tax payment anywhere on the board.",
  cooldownLabel: "10 turns",
  targetType: "tile",
  activeCooldown: 10,
  passives: {
    onRentPaid(room, { holder, ownerId, tileId, rent }) {
      if (!TURF_TILES.has(tileId)) return;
      room.bankMediatedCut(holder.id, Math.floor(rent * 0.3), ownerId);
    },
    onTaxPaid(room, { holder, amount }) {
      room.bankMediatedCut(holder.id, Math.floor(amount * 0.5));
    },
  },
  active(room, caster, { tileId } = {}) {
    const tile = room._board[tileId];
    if (!tile) return { error: "Invalid tile" };
    room.barricade = { tileId, roundPlaced: room.round };
    room.pushLog(`${caster.name} placed a barricade at ${tile.name}.`);
    return { ok: true, tileId };
  },
};
