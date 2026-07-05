import { test, after } from "node:test";
import assert from "node:assert/strict";
import { makeRoom, cleanup } from "./helpers.js";

// Z -- The Enforcer. Passive: 5% bank-mediated cut of tax and trade value.
// Active: Curse redirects the target's net earnings to Z for the rest of the
// round, as the LAST step after any other modifier (e.g. a turf cut) has
// already applied. Z also can never pay to leave the Holding Pen (permanent
// trait, decisions.md).

function ownTile(room, playerId, tileId, houses = 0) {
  room.ownership[tileId] = { ownerId: playerId, houses };
  room.playerById(playerId).properties.push(tileId);
}

test("passive: 5% tax cut is bank-mediated, taxed player pays the normal amount unaffected", () => {
  const room = makeRoom(["Taxed", "Enforcer"]);
  after(() => cleanup(room));
  const taxed = room.playerById("p0");
  const enforcerPlayer = room.playerById("p1");
  enforcerPlayer.character = "Z";

  const taxedBefore = taxed.balance;
  const enforcerBefore = enforcerPlayer.balance;
  taxed.position = 3;
  room.movePlayer(taxed, 1); // tile 4, tax tile, amount 100

  assert.equal(taxed.balance, taxedBefore - 100);
  assert.equal(enforcerPlayer.balance, enforcerBefore + 5);
});

test("passive: 5% trade cut counts cash both ways plus the listed price of every property changing hands", () => {
  const room = makeRoom(["Alice", "Bob", "Enforcer"]);
  after(() => cleanup(room));
  const alice = room.playerById("p0");
  const bob = room.playerById("p1");
  const enforcerPlayer = room.playerById("p2");
  enforcerPlayer.character = "Z";
  ownTile(room, "p0", 1); // سحاب, price 60
  ownTile(room, "p1", 3); // رصيفة, price 60

  const enforcerBefore = enforcerPlayer.balance;
  const proposeResult = room.proposeTrade("p0", {
    toId: "p1", offerProperties: [1], offerMoney: 100, requestProperties: [3], requestMoney: 40,
  });
  room.respondTrade("p1", proposeResult.tradeId, true);

  const expectedTotal = 100 + 40 + 60 + 60; // both money legs + both listed prices
  assert.equal(enforcerPlayer.balance, enforcerBefore + Math.floor(expectedTotal * 0.05));
});

test("active: Curse redirects a cursed owner's rent to Z, unaffected by any other modifier here", () => {
  const room = makeRoom(["Payer", "Owner", "Enforcer"]);
  after(() => cleanup(room));
  const payer = room.playerById("p0");
  const owner = room.playerById("p1");
  const enforcerPlayer = room.playerById("p2");
  enforcerPlayer.character = "Z";
  ownTile(room, "p1", 1); // سحاب, not in anyone's turf

  room.turnIndex = 2; // abilities are turn-gated -- cast on Z's own turn
  const curseResult = room.useAbility("p2", { targetId: "p1" });
  room.turnIndex = 0;
  assert.deepEqual(curseResult, { ok: true, targetId: "p1" });
  assert.equal(enforcerPlayer.abilityCooldown, 7);

  const rent = room.calcRent(room._board[1], room.ownership[1]);
  const payerBefore = payer.balance;
  const ownerBefore = owner.balance;
  const enforcerBefore = enforcerPlayer.balance;

  payer.position = 0;
  room.movePlayer(payer, 1); // lands exactly on tile 1

  assert.equal(payer.balance, payerBefore - rent, "payer still pays the full normal rent");
  assert.equal(owner.balance, ownerBefore, "cursed owner nets nothing from this rent");
  assert.equal(enforcerPlayer.balance, enforcerBefore + rent, "Z gets the full redirected rent");
});

test("active: Curse redirect applies AFTER D's turf cut -- Z gets the owner's net, D keeps their own cut", () => {
  const room = makeRoom(["Payer", "Owner", "Don", "Enforcer"]);
  after(() => cleanup(room));
  const payer = room.playerById("p0");
  const owner = room.playerById("p1");
  const donPlayer = room.playerById("p2");
  const enforcerPlayer = room.playerById("p3");
  donPlayer.character = "D";
  enforcerPlayer.character = "Z";
  ownTile(room, "p1", 13); // اغوار الشمال -- D's turf

  room.turnIndex = 3; // abilities are turn-gated -- cast on Z's own turn
  room.useAbility("p3", { targetId: "p1" }); // curse the owner
  room.turnIndex = 0;

  const rent = room.calcRent(room._board[13], room.ownership[13]);
  const cut = Math.floor(rent * 0.3);
  const netToTarget = rent - cut;

  const payerBefore = payer.balance;
  const ownerBefore = owner.balance;
  const donBefore = donPlayer.balance;
  const enforcerBefore = enforcerPlayer.balance;

  payer.position = 12;
  room.movePlayer(payer, 1); // lands exactly on 13

  assert.equal(payer.balance, payerBefore - rent, "payer pays full normal rent, unaffected by either D or Z");
  assert.equal(owner.balance, ownerBefore, "cursed owner keeps nothing -- their post-cut net was fully redirected");
  assert.equal(donPlayer.balance, donBefore + cut, "D still collects their own turf cut normally -- D isn't cursed");
  assert.equal(enforcerPlayer.balance, enforcerBefore + netToTarget, "Z gets exactly the owner's post-cut net, not the raw rent");
});

test("active: Curse redirects the Start-passing bonus and card 'collect' effects too", () => {
  const room = makeRoom(["Target", "Enforcer"]);
  after(() => cleanup(room));
  const target = room.playerById("p0");
  const enforcerPlayer = room.playerById("p1");
  enforcerPlayer.character = "Z";
  room.turnIndex = 1; // abilities are turn-gated -- cast on Z's own turn
  room.useAbility("p1", { targetId: "p0" });
  room.turnIndex = 0;

  const targetBefore = target.balance;
  const enforcerBefore = enforcerPlayer.balance;
  target.position = 46;
  room.movePlayer(target, 2); // lands exactly on tile 0 -> the 400 landing bonus (not the 200 pass-through one)

  assert.equal(target.balance, targetBefore, "cursed target keeps none of the Start-landing bonus");
  assert.equal(enforcerPlayer.balance, enforcerBefore + 400, "Z gets the full bonus instead");
});

test("active: Curse rejects self-targeting", () => {
  const room = makeRoom(["Enforcer", "Other"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "Z";
  const result = room.useAbility("p0", { targetId: "p0" });
  assert.equal(result.error, "You can't Curse yourself");
});

test("active: Curse rejects an invalid or already-bankrupt target", () => {
  const room = makeRoom(["Enforcer", "Victim"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "Z";
  const victim = room.playerById("p1");
  victim.bankrupt = true;
  const result = room.useAbility("p0", { targetId: "p1" });
  assert.equal(result.error, "Invalid target");
  assert.equal(room.useAbility("p0", { targetId: "nope" }).error, "Invalid target");
});

test("active: Curse expires once Z's own next turn comes around", () => {
  const room = makeRoom(["Target", "Enforcer", "Third"]);
  after(() => cleanup(room));
  const target = room.playerById("p0");
  const enforcerPlayer = room.playerById("p1");
  enforcerPlayer.character = "Z";
  room.turnIndex = 1; // abilities are turn-gated -- cast on Z's own turn
  room.useAbility("p1", { targetId: "p0" });

  room.endTurn(); // p1 -> p2
  assert.equal(room.activeCurses.length, 1, "still active -- not yet Z's own turn again");
  room.endTurn(); // p2 -> p0
  assert.equal(room.activeCurses.length, 1, "still active -- one full lap always takes this long once casting is turn-gated");
  room.endTurn(); // p0 -> p1 (Z's own turn again -- curse should expire right here)
  assert.deepEqual(room.activeCurses, []);

  const before = target.balance;
  target.position = 46;
  room.movePlayer(target, 2); // Start-landing bonus, 400
  assert.equal(target.balance, before + 400, "curse expired -- target keeps their own earnings again");
});

test("active: Curse lasts a full lap even when cast by the LAST seat in turn order -- not just until the next global round boundary", () => {
  // Regression: expiry used to be gated on a global room.round counter, which
  // made a last-seat caster's own curse expire the instant THEIR turn ended
  // (ending their turn is what wraps the seat pointer back to 0), robbing
  // them of almost the entire round other players got. Expiry is now
  // caster-relative, so every caster gets the same full lap regardless of
  // seat position.
  const room = makeRoom(["Target", "Second", "Enforcer"]);
  after(() => cleanup(room));
  const target = room.playerById("p0");
  const enforcerPlayer = room.playerById("p2"); // last seat
  enforcerPlayer.character = "Z";
  room.turnIndex = 2; // it's Z's turn
  room.useAbility("p2", { targetId: "p0" });

  room.endTurn(); // p2 -> p0 (wraps to seat 0 -- the OLD bug expired the curse right here)
  assert.equal(room.activeCurses.length, 1, "still active -- caster-relative expiry, not a global round boundary");

  const before = target.balance;
  const enforcerBefore = enforcerPlayer.balance;
  target.position = 46;
  room.movePlayer(target, 2); // Start-landing bonus, 400
  assert.equal(target.balance, before, "still cursed after a full lap -- Z keeps the redirected earnings");
  assert.equal(enforcerPlayer.balance, enforcerBefore + 400);
});

test("active: a second caster cannot curse a target who's already cursed by someone else", () => {
  const room = makeRoom(["Enforcer", "Fixer", "Victim"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "Z";
  room.playerById("p1").character = "SE";

  room.useAbility("p0", { targetId: "p2" }); // Z curses Victim first
  assert.equal(room.activeCurses.length, 1);

  room.turnIndex = 1; // abilities are turn-gated -- cast on SE's own turn
  const result = room.useAbility("p1", { copyFromId: "p0", params: { targetId: "p2" } }); // SE tries to also curse Victim
  assert.equal(result.error, "t2 is already cursed by someone else");
  assert.equal(room.activeCurses.length, 1, "the rejected attempt didn't add a second curse on the same target");
  assert.equal(room.playerById("p1").abilityCooldown, 0, "a rejected Copy Cat arms no cooldown");
});

test("active: two independent curses can coexist -- Copy Cat's second Curse doesn't overwrite Z's real one", () => {
  const room = makeRoom(["Enforcer", "Fixer", "VictimA", "VictimB"]);
  after(() => cleanup(room));
  const enforcerPlayer = room.playerById("p0");
  const fixerPlayer = room.playerById("p1");
  const victimA = room.playerById("p2");
  const victimB = room.playerById("p3");
  enforcerPlayer.character = "Z";
  fixerPlayer.character = "SE";

  room.useAbility("p0", { targetId: "p2" }); // Z curses VictimA
  room.turnIndex = 1; // abilities are turn-gated -- cast on SE's own turn
  room.useAbility("p1", { copyFromId: "p0", params: { targetId: "p3" } }); // SE copies Curse onto VictimB

  assert.equal(room.activeCurses.length, 2);

  const enforcerBefore = enforcerPlayer.balance;
  const fixerBefore = fixerPlayer.balance;
  room.applyCardEffect(victimA, { type: "collect", amount: 30 });
  room.applyCardEffect(victimB, { type: "collect", amount: 20 });

  assert.equal(victimA.balance, 1500, "VictimA's earnings went to Z, the caster of VictimA's curse");
  assert.equal(enforcerPlayer.balance, enforcerBefore + 30);
  assert.equal(victimB.balance, 1500, "VictimB's earnings went to SE, the caster of VictimB's curse");
  assert.equal(fixerPlayer.balance, fixerBefore + 20);
});

test("active: a mutual curse (A curses B, B curses A) doesn't ping-pong -- each redirect is a terminal, one-hop transfer", () => {
  const room = makeRoom(["Enforcer", "Fixer"]);
  after(() => cleanup(room));
  const enforcerPlayer = room.playerById("p0");
  const fixerPlayer = room.playerById("p1");
  enforcerPlayer.character = "Z";
  fixerPlayer.character = "SE";

  room.useAbility("p0", { targetId: "p1" }); // Z curses SE
  room.turnIndex = 1; // abilities are turn-gated -- cast on SE's own turn
  room.useAbility("p1", { copyFromId: "p0", params: { targetId: "p0" } }); // SE copies Curse back onto Z
  assert.equal(room.activeCurses.length, 2);

  const enforcerBefore = enforcerPlayer.balance;
  const fixerBefore = fixerPlayer.balance;

  // Z earns money -- cursed by SE's copy, so it redirects to SE, full stop.
  room.applyCardEffect(enforcerPlayer, { type: "collect", amount: 30 });
  assert.equal(enforcerPlayer.balance, enforcerBefore, "Z keeps none of it");
  assert.equal(fixerPlayer.balance, fixerBefore + 30, "SE receives it, and only once");

  // SE earns money -- cursed by Z's original, so it redirects to Z (doubled first, SE's own passive).
  const enforcerBefore2 = enforcerPlayer.balance;
  const fixerBefore2 = fixerPlayer.balance;
  room.applyCardEffect(fixerPlayer, { type: "collect", amount: 10 });
  assert.equal(fixerPlayer.balance, fixerBefore2, "SE keeps none of it");
  assert.equal(enforcerPlayer.balance, enforcerBefore2 + 20, "Z receives the doubled amount, and only once -- no loop back to SE");
});

test("drawback: Z can never pay to leave the Holding Pen, permanently, whether or not Curse was ever cast", () => {
  const room = makeRoom(["Enforcer", "Other"]);
  after(() => cleanup(room));
  const enforcerPlayer = room.playerById("p0");
  enforcerPlayer.character = "Z";
  enforcerPlayer.inHolding = true;
  const result = room.payToLeaveHolding("p0");
  assert.equal(result.error, "The Enforcer can't buy their way out of the Holding Pen");
});

test("stacking: D's tax cut and Z's tax cut both independently apply to the same tax payment", () => {
  const room = makeRoom(["Taxed", "Don", "Enforcer"]);
  after(() => cleanup(room));
  const taxed = room.playerById("p0");
  const donPlayer = room.playerById("p1");
  const enforcerPlayer = room.playerById("p2");
  donPlayer.character = "D";
  enforcerPlayer.character = "Z";

  const taxedBefore = taxed.balance;
  taxed.position = 3;
  room.movePlayer(taxed, 1); // tile 4, tax tile, amount 100

  assert.equal(taxed.balance, taxedBefore - 100, "taxed player's bill is unaffected by either cut stacking");
  assert.equal(donPlayer.balance, 1500 + 50);
  assert.equal(enforcerPlayer.balance, 1500 + 5);
});
