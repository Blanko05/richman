// SE -- The Fixer (characters.md).
//
// Passive: the $400/$800 Start bonuses are just the flagship examples of one
// unified rule -- "any payout from the bank is doubled" -- so they aren't
// special-cased here at all; Room.movePlayer's normal 200/400 Start bonus
// already goes through settleEarning with isBankPayout: true, which calls
// modifyBankPayout below and doubles it to 400/800 automatically. Same for
// every other bank payout (card collects, sell/mortgage refunds, ability
// cuts) -- see Room.settleEarning for exactly which call sites qualify.
//
// Active: Copy Cat COPIES another player's active ability and uses an
// independent instance of it immediately, as if SE owned it -- `caster` is
// passed straight through to the copied ability's own active(), so it runs
// using SE's own game-state context (position, ownership, etc.), not the
// original character's. The target's own ability/cooldown is completely
// untouched (decisions.md). Implemented last since it needs every other
// character's active() to already exist.
//
// Note: importing ABILITIES here from ./index.js, which itself imports this
// module to register SE, is a real circular import -- safe in ES modules as
// long as the binding is only read at call-time (inside active(), invoked
// long after the whole module graph has finished loading), never at this
// module's own top-level.
import { ABILITIES } from "./index.js";

export const fixer = {
  id: "SE",
  activeName: "Copy Cat",
  description: "Copies another player's active ability and uses it immediately as his own. Pick who to copy, then their ability's target if it needs one.",
  passiveDescription: "Doubles every bank payout (Start bonus, card draws, refunds, other characters' ability cuts).",
  cooldownLabel: "5 turns + half the copied ability's cooldown (rounded down)",
  // Distinct from plain "player" (Curse) -- tells the client this is a
  // two-step pick: step 1 (this value) is who to copy from, and step 2
  // depends on THAT player's own ability's targetType (see App.jsx's
  // targeting state machine).
  targetType: "copyFrom",
  activeCooldown: (result) => 5 + Math.floor(result.copiedCooldown / 2),
  modifyBankPayout(room, { amount }) {
    return amount * 2;
  },
  active(room, caster, { copyFromId, params } = {}) {
    // Unlike Curse/Hostile Takeover, Copy Cat never acts ON the target --
    // it only reads which character they picked, then runs an independent
    // copy of that ability as SE himself. A bankrupt/left player's character
    // choice is still on record, so there's nothing bankruptcy-unsafe about
    // copying it. User's call.
    const target = room.playerById(copyFromId);
    if (!target) return { error: "Invalid target" };
    if (copyFromId === caster.id) return { error: "You can't Copy Cat yourself" };
    if (!target.character) return { error: "Target has no character" };
    const ability = ABILITIES[target.character];
    if (!ability) return { error: "Target has no ability to copy" };
    const result = ability.active(room, caster, params);
    if (result?.error) return result;
    room.pushLog(`${caster.name} used Copy Cat to copy ${target.name}'s ability.`);
    const copiedCooldown = typeof ability.activeCooldown === "function"
      ? ability.activeCooldown(result)
      : ability.activeCooldown;
    return { ok: true, ...result, copiedCooldown };
  },
};
