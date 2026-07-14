// D -- The Don (characters.md).
//
// Passive: 30% bank-mediated cut of rent collected on his turf zone
// (deducted from the property owner -- if D owns the tile himself, owner
// and holder are the same player, so the add/subtract nets to zero and D
// simply keeps the full rent as owner, no double-dip); 30% bank-mediated cut
// of any tax payment anywhere (bank absorbs -- tax has no player "earner" to
// deduct from). Percentage cuts round down, same floor-biased convention
// Room.js already uses for house-sale refunds/mortgage values.
//
// Active: Barricade places a wall that's a one-shot trap, not a lasting wall
// -- it catches only the FIRST player whose forward movement crosses it, D
// himself included (no caster immunity, see Room.applyBarricade), then
// deactivates immediately, or expires unused once D's own next turn comes
// around (decisions.md's
// "Round scoping" -- caster-relative, not a global round boundary). See
// Room.applyBarricade for the actual movement-interception math (forward
// movement only; decisions.md).
const TURF_TILES = new Set([13, 14, 16]); // salmonRight -- characters.md

export const don = {
  id: "D",
  activeName: "Barricade",
  description: "Places a wall on a tile that traps the first player who crosses it. Disappears when triggered, or by your next turn if it isn't.",
  passiveDescription: "Takes a 30% cut of rent on his turf and 30% of every tax payment, board-wide.",
  cooldownLabel: "10 turns",
  targetType: "tile",
  activeCooldown: 10,
  passives: {
    onRentPaid(room, { holder, ownerId, tileId, rent }) {
      if (!TURF_TILES.has(tileId)) return;
      room.bankMediatedCut(holder.id, Math.floor(rent * 0.3), ownerId, "turf rent cut");
    },
    onTaxPaid(room, { holder, amount }) {
      room.bankMediatedCut(holder.id, Math.floor(amount * 0.3), null, "tax cut");
    },
  },
  active(room, caster, { tileId } = {}) {
    const tile = room._board[tileId];
    if (!tile) return { error: "Invalid tile" };
    room.barricade = { tileId, casterId: caster.id };
    room.pushLog(`${caster.name} placed a barricade at ${tile.name}.`);
    return { ok: true, tileId };
  },
};
