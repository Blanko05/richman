// Y -- The Wrecker (characters.md).
//
// Passive reacts to ANY player's demolish/mortgage at the table, including
// Y's own -- the spec has no self-exclusion for this one (unlike actives,
// which all ban self-targeting; this passive doesn't target anyone, it just
// watches for an event).
//
// Detonate fully levels whatever's built on the target in one shot (down to
// an empty lot) rather than removing one level at a time -- see decisions.md.
// Cooldown scales with how much was destroyed; index = houses removed (0-5,
// where 5 is a hotel), matching characters.md's table exactly.
import { TILE_TYPES } from "../board.js";

const DETONATE_COOLDOWN_BY_LEVELS = [4, 5, 6, 7, 8, 9];

export const wrecker = {
  id: "Y",
  activeName: "Detonate",
  // Display metadata for the client (CharacterPanel) -- targetType tells it
  // what kind of picker to show; "tile" means clicking a board tile submits
  // { tileId }.
  description: "Fully destroys the building on a targeted property (yours or another player's), leaving it an empty lot.",
  passiveDescription: "Collects $50 from the bank whenever any player demolishes a house/hotel level or mortgages a property.",
  cooldownLabel: "4-9 turns, scaling with how much was destroyed",
  targetType: "tile",
  activeCooldown: (result) => DETONATE_COOLDOWN_BY_LEVELS[result.levelsRemoved],
  passives: {
    onDemolish(room, { holder }) {
      room.bankMediatedCut(holder.id, 50);
    },
    onMortgage(room, { holder }) {
      room.bankMediatedCut(holder.id, 50);
    },
  },
  active(room, caster, { tileId } = {}) {
    const tile = room._board[tileId];
    if (!tile || tile.type !== TILE_TYPES.PROPERTY) return { error: "Invalid target" };
    const owned = room.ownership[tileId];
    if (!owned) return { error: "That property isn't owned by anyone" };
    if (owned.ownerId === caster.id) return { error: "You can't Detonate your own property" };
    const target = room.playerById(owned.ownerId);
    const levelsRemoved = owned.houses || 0;
    owned.houses = 0;
    room.pushLog(`${caster.name} used Detonate on ${tile.name}, destroying ${levelsRemoved} level(s) owned by ${target.name}.`);
    room.triggerPassive("onDemolish", { player: target, tileId, levelsRemoved });
    return { ok: true, levelsRemoved };
  },
};
