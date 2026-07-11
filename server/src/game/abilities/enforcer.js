// Z -- The Enforcer (characters.md).
//
// Passive: 5% bank-mediated cut of every completed trade's total value (cash
// both sides + listed board price of any properties changing hands) and 5%
// of every tax payment. Both are bank-absorbed, same reasoning as D's tax cut
// -- a tax/trade event has no single player "earner" to deduct from.
//
// Active: Curse redirects everything the target nets to Z, until Z's own
// next turn comes around (not a global round boundary -- decisions.md; this
// keeps the effect's duration equally fair regardless of the caster's seat
// position) -- implemented via Room.activeCurses (a list, not a single slot
// -- Copy Cat can cast an independent second Curse of its own) +
// Room.settleEarning, which wraps every earning-producing call site in
// Room.js so the redirect always applies to the fully-computed final amount
// (decisions.md). Z also carries a permanent drawback, unconditional and
// unrelated to Curse itself: see Room.payToLeaveHolding.
export const enforcer = {
  id: "Z",
  activeName: "Curse",
  description: "Targets a player and redirects everything they earn to him, until his own next turn.",
  passiveDescription: "Takes 5% of every trade's value and 5% of every tax payment. Can never pay to leave the Holding Pen early.",
  cooldownLabel: "7 turns",
  targetType: "player",
  activeCooldown: 7,
  passives: {
    onTaxPaid(room, { holder, amount }) {
      room.bankMediatedCut(holder.id, Math.floor(amount * 0.05));
    },
    onTradeCompleted(room, { holder, totalTradeValue }) {
      room.bankMediatedCut(holder.id, Math.floor(totalTradeValue * 0.05));
    },
  },
  active(room, caster, { targetId } = {}) {
    const target = room.playerById(targetId);
    if (!target || target.bankrupt || target.left) return { error: "Invalid target" };
    if (targetId === caster.id) return { error: "You can't Curse yourself" };
    // Two different casters can never curse the SAME target at once -- only
    // multiple curses from DIFFERENT casters targeting DIFFERENT players are
    // allowed to coexist (decisions.md). Checked before the same-caster
    // cleanup below, so re-cursing your OWN existing target (a no-op in
    // practice; cooldown already prevents it) doesn't trip this rejection.
    const alreadyCursedByOther = room.activeCurses.some((c) => c.targetId === targetId && c.casterId !== caster.id);
    if (alreadyCursedByOther) return { error: `${target.name} is already cursed by someone else` };
    // Defensive, not load-bearing: cooldown gating already prevents the same
    // caster from having two of their own curses active at once, but drop any
    // stale entry from this caster first rather than assume it can't happen.
    room.activeCurses = room.activeCurses.filter((c) => c.casterId !== caster.id);
    room.activeCurses.push({ targetId, casterId: caster.id });
    room.pushLog(`${caster.name} cursed ${target.name} until their own next turn.`);
    return { ok: true, targetId };
  },
};
