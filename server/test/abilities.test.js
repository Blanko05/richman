import { test, after } from "node:test";
import assert from "node:assert/strict";
import { makeRoom, cleanup } from "./helpers.js";

// Ability *effects* aren't implemented yet (see characters.md/progress.md) --
// these tests only cover the scaffolding: eligibility checks, cooldown
// start/decrement, and that it's gated like other turn actions.

test("useAbility rejects a character with no such ability", () => {
  const room = makeRoom();
  after(() => cleanup(room));
  room.players[0].characterId = "don";

  const result = room.useAbility("p0", "curse"); // curse belongs to the enforcer, not the don

  assert.equal(result.error, "That character has no such ability");
});

test("useAbility rejects when it isn't the player's turn", () => {
  const room = makeRoom();
  after(() => cleanup(room));
  room.players[1].characterId = "enforcer";

  const result = room.useAbility("p1", "curse");

  assert.equal(result.error, "Not your turn");
});

test("useAbility starts the cooldown and rejects a second use while charging", () => {
  const room = makeRoom();
  after(() => cleanup(room));
  const alice = room.players[0];
  alice.characterId = "don";

  const first = room.useAbility("p0", "barricade");
  assert.deepEqual(first, { ok: true });
  assert.equal(alice.abilityCooldowns.barricade, 10);

  const second = room.useAbility("p0", "barricade");
  assert.equal(second.error, "Still recharging (10 turn(s) left)");
});

test("a cooldown decrements by exactly one per the ability owner's own elapsed turn", () => {
  const room = makeRoom(["Alice", "Bob"]);
  after(() => cleanup(room));
  const alice = room.players[0];
  alice.characterId = "don";
  room.lastRoll = [1, 1];

  room.useAbility("p0", "barricade");
  assert.equal(alice.abilityCooldowns.barricade, 10);

  room.playerEndTurn("p0"); // Alice's turn ends -- her cooldown ticks down
  assert.equal(alice.abilityCooldowns.barricade, 9);

  room.lastRoll = [2, 2]; // Bob rolls doubles, gets a bonus roll, then ends his turn
  room.playerEndTurn("p1");
  assert.equal(alice.abilityCooldowns.barricade, 9, "doesn't tick down on someone else's turn ending");
});

test("kingpin's two actives recharge independently", () => {
  const room = makeRoom();
  after(() => cleanup(room));
  const alice = room.players[0];
  alice.characterId = "kingpin";

  assert.deepEqual(room.useAbility("p0", "flankSeizure"), { ok: true });
  assert.equal(alice.abilityCooldowns.flankSeizure, 12);
  assert.equal(alice.abilityCooldowns.hostileTakeover, undefined, "the other active is untouched");

  const result = room.useAbility("p0", "hostileTakeover");
  assert.deepEqual(result, { ok: true }, "still usable even though the player's other active is on cooldown");
  assert.equal(alice.abilityCooldowns.hostileTakeover, 7);
});
