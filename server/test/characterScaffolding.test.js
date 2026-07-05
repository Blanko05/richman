import { test, after } from "node:test";
import assert from "node:assert/strict";
import { makeRoom, cleanup } from "./helpers.js";
import { Room } from "../src/game/Room.js";
import { ABILITIES } from "../src/game/abilities/index.js";

// A pre-start room -- makeRoom() from helpers.js always calls room.start(),
// which is too late to exercise selectCharacter's pre-start-only rules.
// Defaults to "characters" mode since this whole file is about character-
// selection scaffolding, which only matters (i.e. only gates playerStartGame)
// in that mode -- see Room.js's playerStartGame.
function makeLobbyRoom(names = ["Alice", "Bob"], mode = "characters") {
  const room = new Room("TEST", "p0", mode);
  names.forEach((name, i) => room.addPlayer(`p${i}`, name, `t${i}`));
  return room;
}

test("selectCharacter enforces one character per room, mirroring icon uniqueness", () => {
  const room = makeLobbyRoom();
  after(() => cleanup(room));
  assert.deepEqual(room.selectCharacter("p0", "D"), { ok: true });
  assert.equal(room.selectCharacter("p1", "D").error, "Character already taken");
  assert.deepEqual(room.selectCharacter("p1", "Z"), { ok: true });
});

test("selectCharacter rejects an unknown character id", () => {
  const room = makeLobbyRoom();
  after(() => cleanup(room));
  assert.equal(room.selectCharacter("p0", "NOT_REAL").error, "Invalid character");
});

test("selectCharacter is locked out once the game has started", () => {
  const room = makeRoom();
  after(() => cleanup(room));
  assert.equal(room.selectCharacter("p0", "D").error, "Game already started");
});

test("playerStartGame requires every active player to have picked a character, same as icons", () => {
  const room = makeLobbyRoom();
  after(() => cleanup(room));
  room.setPlayerIcon("p0", "italian");
  room.setPlayerIcon("p1", "american");
  const beforeCharacters = room.playerStartGame("p0");
  assert.equal(beforeCharacters.error, "Every player must choose a character before starting");
  assert.equal(room.started, false);

  room.selectCharacter("p0", "D");
  room.selectCharacter("p1", "Z");
  assert.deepEqual(room.playerStartGame("p0"), { ok: true });
  assert.equal(room.started, true);
});

test("playerStartGame does NOT require a character in normal mode -- only characters mode gates on it", () => {
  const room = makeLobbyRoom(["Alice", "Bob"], "normal");
  after(() => cleanup(room));
  room.setPlayerIcon("p0", "italian");
  room.setPlayerIcon("p1", "american");
  assert.deepEqual(room.playerStartGame("p0"), { ok: true }, "no character ever selected, starts fine in normal mode");
  assert.equal(room.started, true);
});

test("a round is one full lap of the seat array, counted independent of active-player count", () => {
  const room = makeRoom(["Alice", "Bob", "Carol"]);
  after(() => cleanup(room));
  assert.equal(room.round, 0);
  room.endTurn(); // p0 -> p1
  assert.equal(room.round, 0);
  room.endTurn(); // p1 -> p2
  assert.equal(room.round, 0);
  room.endTurn(); // p2 -> p0 (wraps)
  assert.equal(room.round, 1);
  room.endTurn(); // p0 -> p1
  room.endTurn(); // p1 -> p2
  room.endTurn(); // p2 -> p0 (wraps again)
  assert.equal(room.round, 2);
});

test("round survives toState/toSnapshot round-tripping", () => {
  const room = makeRoom(["Alice", "Bob"]);
  after(() => cleanup(room));
  room.endTurn();
  room.endTurn();
  assert.equal(room.round, 1);
  assert.equal(room.toState().round, 1);
  assert.equal(room.toSnapshot().round, 1);
  const restored = Room.fromSnapshot(room.toSnapshot());
  after(() => cleanup(restored));
  assert.equal(restored.round, 1);
});

test("ability cooldown only ticks down on the holder's own turn ending, not anyone else's", () => {
  const room = makeRoom(["Alice", "Bob"]);
  after(() => cleanup(room));
  const p0 = room.playerById("p0");
  p0.abilityCooldown = 3;
  room.endTurn(); // p0's turn ends -- their own cooldown ticks
  assert.equal(p0.abilityCooldown, 2);
  room.endTurn(); // p1's turn ends -- p0 untouched
  assert.equal(p0.abilityCooldown, 2);
  room.endTurn(); // p0's turn ends again
  assert.equal(p0.abilityCooldown, 1);
});

test("bankMediatedCut pays the holder from the bank and, when given a source player, deducts the same amount from them", () => {
  const room = makeRoom(["Alice", "Bob"]);
  after(() => cleanup(room));
  const p0 = room.playerById("p0");
  const p1 = room.playerById("p1");
  const p0Before = p0.balance;
  const p1Before = p1.balance;

  room.bankMediatedCut("p0", 100, "p1"); // e.g. D's turf cut, deducted from the owner
  assert.equal(p0.balance, p0Before + 100);
  assert.equal(p1.balance, p1Before - 100);

  room.bankMediatedCut("p0", 50); // e.g. a tax cut -- bank absorbs, nobody else is charged
  assert.equal(p0.balance, p0Before + 150);
  assert.equal(p1.balance, p1Before - 100);
});

test("triggerPassive calls only active, characterized players' matching hook", () => {
  const room = makeRoom(["Alice", "Bob", "Carol"]);
  after(() => cleanup(room));
  const p0 = room.playerById("p0");
  const p1 = room.playerById("p1");
  const p2 = room.playerById("p2");
  p0.character = "D";
  p1.character = "Z";
  p2.character = "D"; // would match too, but is bankrupt below -- must be skipped
  p2.bankrupt = true;

  const calls = [];
  // Temporarily register fake abilities directly in the real registry so this
  // exercises the actual dispatch path (Room.triggerPassive -> abilityFor),
  // not a reimplementation of it. Restores the REAL D/Z entries afterward
  // (not just `delete`s the fakes) -- node:test runs every test in a file in
  // one process, so leaving the registry's real D/Z permanently missing would
  // silently break any later test in this file that uses those characters.
  const realD = ABILITIES.D;
  const realZ = ABILITIES.Z;
  ABILITIES.D = { passives: { onTestHook: (r, payload) => calls.push(payload.holder.id) } };
  ABILITIES.Z = { passives: {} }; // no handler for this hook -- must be skipped silently, not throw
  try {
    room.triggerPassive("onTestHook", {});
  } finally {
    ABILITIES.D = realD;
    ABILITIES.Z = realZ;
  }
  assert.deepEqual(calls, ["p0"]); // only p0 (active, D, has the hook) -- not p1 (no handler) or p2 (bankrupt)
});

test("useAbility rejects a player with no character selected", () => {
  const room = makeRoom();
  after(() => cleanup(room));
  const result = room.useAbility("p0", {});
  assert.equal(result.error, "No character selected");
});

test("useAbility rejects a character code with no ability registered (defensive -- all 6 real characters are registered today)", () => {
  const room = makeRoom();
  after(() => cleanup(room));
  room.playerById("p0").character = "NOT_A_REAL_CHARACTER";
  const result = room.useAbility("p0", {});
  assert.equal(result.error, "Unknown character");
});

test("useAbility is turn-gated -- only usable on the caster's own turn", () => {
  const room = makeRoom(["Alice", "Bob"]);
  after(() => cleanup(room));
  room.playerById("p1").character = "D";
  const result = room.useAbility("p1", { tileId: 4 }); // it's p0's turn, not p1's
  assert.equal(result.error, "Not your turn");

  room.endTurn(); // now it's p1's turn
  assert.deepEqual(room.useAbility("p1", { tileId: 4 }), { ok: true, tileId: 4 });
});
