import { test, after } from "node:test";
import assert from "node:assert/strict";
import { makeRoom, cleanup, withDice } from "./helpers.js";
import { SURPRISE_CARDS } from "../src/game/cards.js";

// Force a specific card to the top of the deck so the scenario is deterministic
// rather than depending on shuffle order.
function forceTopCard(room, deckKey, cardId) {
  const card = SURPRISE_CARDS.find((c) => c.id === cardId);
  room[deckKey] = [card, ...room[deckKey].filter((c) => c.id !== cardId)];
}

test("a movement card defers the move until confirmCardMove is called", () => {
  const room = makeRoom();
  after(() => cleanup(room));
  const alice = room.players[0];
  forceTopCard(room, "surpriseDeck", "s6"); // "ارجعلي 3 خطوات اغلبك" (move back 3)
  alice.position = 23; // tile 26 is Surprise, 3 tiles away

  const rollResult = withDice([[2, 1]], () => room.rollDice("p0"));

  assert.equal(rollResult.awaitingCardMove, true);
  assert.equal(alice.position, 26, "still sitting on the card tile -- the move hasn't happened yet");
  assert.equal(room.pendingAction.type, "awaitCardMove");
  assert.equal(room.lastCard.text, "ارجعلي 3 خطوات اغلبك");

  const confirmResult = room.confirmCardMove("p0");

  assert.deepEqual(confirmResult, { ok: true });
  assert.equal(alice.position, 23, "moved back 3 from the card tile");
  // Tile 23 is an unowned property (goldenrod group) in the Classic Vintage
  // board, so resolveTile correctly opens a fresh awaitBuy here -- the thing
  // actually under test (the card move itself resolving once confirmed) is
  // done; a new pendingAction for an unrelated decision is expected, not a bug.
  assert.notEqual(room.pendingAction?.type, "awaitCardMove");
});

test("confirmCardMove rejects a player who isn't the one the card is pending for", () => {
  const room = makeRoom();
  after(() => cleanup(room));
  room.pendingAction = { type: "awaitCardMove", playerId: "p0", effect: { type: "move", steps: -3 } };

  const result = room.confirmCardMove("p1");

  assert.equal(result.error, "No card move to confirm");
  assert.notEqual(room.pendingAction, null, "still pending -- the wrong confirm must not have consumed it");
});

test("the deferred bonus-roll calculation completes correctly once confirmed", () => {
  const room = makeRoom();
  after(() => cleanup(room));
  const alice = room.players[0];
  forceTopCard(room, "surpriseDeck", "s6");
  alice.position = 24; // 2 tiles before tile 26, the other Surprise tile (must be an even distance for a double roll)

  // Roll doubles (free play) and land on the card tile in the same move.
  const rollResult = withDice([[1, 1]], () => room.rollDice("p0"));
  assert.equal(rollResult.awaitingCardMove, true);

  room.confirmCardMove("p0");

  assert.equal(room.canRollAgain, true, "the roll really was a free-play double, so the bonus roll is granted once resolved");
});

test("confirmCardMove also handles the advanceTo effect (collecting Start Plaza's bonus)", () => {
  const room = makeRoom();
  after(() => cleanup(room));
  const alice = room.players[0];
  forceTopCard(room, "surpriseDeck", "s4"); // "طريقك خضرة, روح عالبداية وخذ 200 دينار" (advance to Start Plaza)
  alice.position = 12; // tile 15 is Surprise, 3 tiles away
  const balanceBefore = alice.balance;

  withDice([[2, 1]], () => room.rollDice("p0")); // lands on tile 15, draws s4
  assert.equal(room.pendingAction.type, "awaitCardMove");

  room.confirmCardMove("p0");

  assert.equal(alice.position, 0);
  assert.equal(alice.balance, balanceBefore + 200);
  assert.equal(room.pendingAction, null, "Start Plaza has no further effect, nothing left pending");
});

test("regression: a cursed player's advanceTo-Start card bonus is redirected to Z, not kept", () => {
  // Bug: confirmCardMove's collectStart branch used to do `player.balance += 200`
  // directly instead of going through settleEarning, so it bypassed Curse's
  // redirect entirely (and SE's bank-payout doubling) -- a cursed player who
  // drew this card kept the 200 anyway, while the normal pass/land-on-Start
  // bonus from rolling dice correctly went through settleEarning already.
  const room = makeRoom(["Cursed", "Enforcer"]);
  after(() => cleanup(room));
  const alice = room.players[0];
  const enforcerPlayer = room.players[1];
  enforcerPlayer.character = "Z";
  room.turnIndex = 1; // abilities are turn-gated -- cast on Z's own turn
  room.useAbility("p1", { targetId: "p0" }); // curse Alice
  room.turnIndex = 0; // back to Alice's turn to roll
  forceTopCard(room, "surpriseDeck", "s4"); // advance to Start Plaza, collect 200
  alice.position = 12; // tile 15 is Surprise, 3 tiles away
  const aliceBefore = alice.balance;
  const enforcerBefore = enforcerPlayer.balance;

  withDice([[2, 1]], () => room.rollDice("p0")); // lands on tile 15, draws s4
  room.confirmCardMove("p0");

  assert.equal(alice.position, 0);
  assert.equal(alice.balance, aliceBefore, "cursed -- keeps none of the card's bonus");
  assert.equal(enforcerPlayer.balance, enforcerBefore + 200, "the redirected 200 goes to Z instead");
});

test("a goToHolding card effect is NOT deferred -- it resolves immediately, not via confirmCardMove", () => {
  const room = makeRoom();
  after(() => cleanup(room));
  const alice = room.players[0];
  forceTopCard(room, "surpriseDeck", "s5"); // "ميل عالقرايب, زمان ما زرتهم" (go directly to Holding Pen)
  alice.position = 12; // tile 15 is Surprise, 3 tiles away

  withDice([[2, 1]], () => room.rollDice("p0"));

  assert.equal(alice.inHolding, true, "happened immediately, no confirmation step for this effect");
  assert.equal(room.pendingAction, null);
});
