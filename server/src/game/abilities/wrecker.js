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
//
// If the target already has nothing built (an empty lot), there's nothing to
// demolish -- so Detonate force-mortgages it instead, for free (no payout to
// the owner, unlike a voluntary mortgageProperty -- this is punitive, not a
// favor). This also fires the onMortgage passive manually, the same way the
// demolish branch manually fires onDemolish, so Y still collects his own $50
// cut for an effect that didn't go through the real mortgageProperty() call.
// If it's already mortgaged, there's truly nothing left to do -- rejected
// outright rather than a silent no-op, same tone as the self-targeting
// rejections below. User's call (decisions.md).
import { TILE_TYPES } from "../board.js";

const DETONATE_COOLDOWN_BY_LEVELS = [4, 5, 6, 7, 8, 10];

export const wrecker = {
  id: "Y",
  activeName: "Detonate",
  // Display metadata for the client (CharacterPanel) -- targetType tells it
  // what kind of picker to show; "tile" means clicking a board tile submits
  // { tileId }.
  description: "Fully destroys the building on another player's property, leaving an empty lot -- or forces it into mortgage if nothing's built there.",
  passiveDescription: "Collects $50 whenever any player demolishes a building level or mortgages a property.",
  cooldownLabel: "4-10 turns (scales with damage dealt)",
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
    if (!owned.houses) {
      if (owned.mortgaged) return { error: "Nothing left to destroy on this property" };
      owned.mortgaged = true;
      room.pushLog(`${caster.name} used Detonate on ${tile.name}, forcing it into mortgage since ${target.name} had nothing built there.`);
      room.triggerPassive("onMortgage", { player: target, tileId });
      // Client-animation broadcast only (see Room.js's detonateSeq comment)
      // -- one event covers both the crosshair-flash cast moment and the
      // payoff, since (unlike Barricade/Curse) there's no gap in time
      // between them to justify two separate seq pairs.
      room.detonateSeq += 1;
      room.lastDetonate = { casterId: caster.id, targetId: target.id, tileId, levelsRemoved: 0, forcedMortgage: true };
      return { ok: true, levelsRemoved: 0, forcedMortgage: true };
    }
    const levelsRemoved = owned.houses;
    owned.houses = 0;
    room.pushLog(`${caster.name} used Detonate on ${tile.name}, destroying ${levelsRemoved} level(s) owned by ${target.name}.`);
    room.triggerPassive("onDemolish", { player: target, tileId, levelsRemoved });
    room.detonateSeq += 1;
    room.lastDetonate = { casterId: caster.id, targetId: target.id, tileId, levelsRemoved, forcedMortgage: false };
    return { ok: true, levelsRemoved };
  },
};
