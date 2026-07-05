import { test, after } from "node:test";
import assert from "node:assert/strict";
import { makeRoom, cleanup } from "./helpers.js";

// SE -- The Fixer. Passive: every bank payout is doubled (Start bonus is just
// the flagship example, not a special case). Active: Copy Cat copies another
// character's active and uses an independent instance of it as SE, leaving
// the original owner's cooldown untouched.

function ownTile(room, playerId, tileId, houses = 0) {
  room.ownership[tileId] = { ownerId: playerId, houses };
  room.playerById(playerId).properties.push(tileId);
}

test("passive: Start-passing and Start-landing bonuses are doubled to 400/800", () => {
  const room = makeRoom(["Fixer"]);
  after(() => cleanup(room));
  const fixerPlayer = room.playerById("p0");
  fixerPlayer.character = "SE";

  fixerPlayer.position = 46;
  const before = fixerPlayer.balance;
  room.movePlayer(fixerPlayer, 5); // passes Start, doesn't land on it
  assert.equal(fixerPlayer.balance, before + 400);

  fixerPlayer.position = 46;
  const before2 = fixerPlayer.balance;
  room.movePlayer(fixerPlayer, 2); // lands exactly on Start
  assert.equal(fixerPlayer.balance, before2 + 800);
});

test("passive: a card 'collect' bank payout is doubled", () => {
  const room = makeRoom(["Fixer"]);
  after(() => cleanup(room));
  const fixerPlayer = room.playerById("p0");
  fixerPlayer.character = "SE";
  const before = fixerPlayer.balance;
  room.applyCardEffect(fixerPlayer, { type: "collect", amount: 50 });
  assert.equal(fixerPlayer.balance, before + 100);
});

test("passive: sellHouse and mortgage refunds are doubled -- both are bank payouts", () => {
  const room = makeRoom(["Fixer", "Other"]);
  after(() => cleanup(room));
  const fixerPlayer = room.playerById("p0");
  fixerPlayer.character = "SE";
  room.debugGrantGroup("p0", "olive"); // tiles 10, 11
  room.ownership[10].houses = 1; // for the sellHouse leg
  // tile 11 stays undeveloped (houses: 0, set by debugGrantGroup) -- mortgageProperty
  // requires houses already sold, so it can't share tile 10 with the sellHouse leg above.

  const houseRefund = Math.floor(room._board[10].housePrice / 2);
  const before = fixerPlayer.balance;
  room.sellHouse("p0", 10);
  assert.equal(fixerPlayer.balance, before + houseRefund * 2);

  const mortgageValue = Math.floor(room._board[11].price / 2);
  const before2 = fixerPlayer.balance;
  room.mortgageProperty("p0", 11);
  assert.equal(fixerPlayer.balance, before2 + mortgageValue * 2);
});

test("passive: rent and trade money are NOT doubled -- SE's doubling is scoped to genuine bank payouts", () => {
  const room = makeRoom(["Payer", "Fixer", "Trader"]);
  after(() => cleanup(room));
  const payer = room.playerById("p0");
  const fixerPlayer = room.playerById("p1");
  fixerPlayer.character = "SE";
  ownTile(room, "p1", 1);

  const rent = room.calcRent(room._board[1], room.ownership[1]);
  const before = fixerPlayer.balance;
  payer.position = 0;
  room.movePlayer(payer, 1);
  assert.equal(fixerPlayer.balance, before + rent, "rent is player-to-player, never doubled");

  ownTile(room, "p2", 3);
  const beforeTrade = fixerPlayer.balance;
  const propose = room.proposeTrade("p2", { toId: "p1", requestMoney: 0, offerMoney: 40, offerProperties: [] });
  room.respondTrade("p1", propose.tradeId, true);
  assert.equal(fixerPlayer.balance, beforeTrade + 40, "trade cash is never doubled either");
});

test("passive + active ordering: SE's doubling applies BEFORE Curse's redirect, so a cursed SE loses the doubled amount", () => {
  const room = makeRoom(["Fixer", "Enforcer"]);
  after(() => cleanup(room));
  const fixerPlayer = room.playerById("p0");
  const enforcerPlayer = room.playerById("p1");
  fixerPlayer.character = "SE";
  enforcerPlayer.character = "Z";
  room.useAbility("p1", { targetId: "p0" }); // curse SE

  const fixerBefore = fixerPlayer.balance;
  const enforcerBefore = enforcerPlayer.balance;
  room.applyCardEffect(fixerPlayer, { type: "collect", amount: 50 });

  assert.equal(fixerPlayer.balance, fixerBefore, "cursed SE keeps nothing");
  assert.equal(enforcerPlayer.balance, enforcerBefore + 100, "Z gets the DOUBLED amount (100), not the raw 50");
});

test("active: Copy Cat copies Y's Detonate, using SE's own targeting, and doesn't touch Y's cooldown", () => {
  const room = makeRoom(["Fixer", "Wrecker", "Victim"]);
  after(() => cleanup(room));
  const fixerPlayer = room.playerById("p0");
  const wreckerPlayer = room.playerById("p1");
  fixerPlayer.character = "SE";
  wreckerPlayer.character = "Y";
  room.debugGrantGroup("p2", "olive");
  room.ownership[10].houses = 5; // hotel

  const result = room.useAbility("p0", { copyFromId: "p1", params: { tileId: 10 } });
  assert.equal(result.ok, true);
  assert.equal(result.levelsRemoved, 5);
  assert.equal(room.ownership[10].houses, 0, "the hotel was fully wiped, exactly like a real Detonate");
  assert.equal(wreckerPlayer.abilityCooldown, 0, "Y's own cooldown is completely untouched -- copy, not steal");
  assert.equal(fixerPlayer.abilityCooldown, 5 + Math.floor(9 / 2), "SE's own cooldown: 5 + half of Detonate's 9-turn cooldown, rounded down");
});

test("active: Copy Cat copies Z's Curse, casting it as SE rather than the original Z", () => {
  const room = makeRoom(["Fixer", "Enforcer", "Victim"]);
  after(() => cleanup(room));
  const fixerPlayer = room.playerById("p0");
  fixerPlayer.character = "SE";
  room.playerById("p1").character = "Z";

  const result = room.useAbility("p0", { copyFromId: "p1", params: { targetId: "p2" } });
  assert.equal(result.ok, true);
  assert.deepEqual(room.activeCurses, [{ targetId: "p2", casterId: "p0", roundPlaced: 0 }]);
  assert.equal(fixerPlayer.abilityCooldown, 5 + Math.floor(7 / 2)); // Curse's static 7-turn cooldown
});

test("active: Copy Cat copies SD's Wrecking Tour using SE's own position, not the original SD's", () => {
  const room = makeRoom(["Fixer", "Conductor", "Victim"]);
  after(() => cleanup(room));
  const fixerPlayer = room.playerById("p0");
  fixerPlayer.character = "SE";
  room.playerById("p1").character = "SD";
  fixerPlayer.position = 4; // path from SE's position: 5, 6
  room.playerById("p1").position = 40; // SD's own position must be ignored
  ownTile(room, "p2", 5, 1);

  const result = room.useAbility("p0", { copyFromId: "p1", params: {} });
  assert.equal(result.ok, true);
  assert.equal(result.tilesPassed, 2, "path computed from SE's position (4), not SD's (40)");
  assert.equal(room.ownership[5].houses, 0);
});

test("active: Copy Cat rejects self-targeting", () => {
  const room = makeRoom(["Fixer", "Other"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "SE";
  const result = room.useAbility("p0", { copyFromId: "p0", params: {} });
  assert.equal(result.error, "You can't Copy Cat yourself");
});

test("active: Copy Cat rejects a target with no character, and an invalid target", () => {
  const room = makeRoom(["Fixer", "NoCharacter"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "SE";
  assert.equal(room.useAbility("p0", { copyFromId: "p1", params: {} }).error, "Target has no character");
  assert.equal(room.useAbility("p0", { copyFromId: "nope", params: {} }).error, "Invalid target");
});

test("active: Copy Cat propagates a rejection from the copied ability itself (e.g. Detonate's own self-targeting rule)", () => {
  const room = makeRoom(["Fixer", "Wrecker"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "SE";
  room.playerById("p1").character = "Y";
  room.debugGrantGroup("p0", "olive"); // SE owns it -- Detonate can't target your own property

  const result = room.useAbility("p0", { copyFromId: "p1", params: { tileId: 10 } });
  assert.equal(result.error, "You can't Detonate your own property");
  assert.equal(room.playerById("p0").abilityCooldown, 0, "a rejected copy arms no cooldown");
});
