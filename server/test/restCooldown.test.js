import { test, after } from "node:test";
import assert from "node:assert/strict";
import { makeRoom, cleanup } from "./helpers.js";

// Both "عليكم الأمان" tiles (17, 46) AND "استراحة محارب" (tile 24) ease the
// landing player's ability cooldown by a random 1-4 turns, clamped at 0
// (decisions.md). A third REST-type tile (اجازة/Vacation) is NOT included --
// name-scoped, not TILE_TYPES.REST-scoped -- it keeps only the existing
// vacation-pot payout.

function withFixedRandom(value, fn) {
  const orig = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = orig;
  }
}

test("landing on 'عليكم الأمان' eases the cooldown by 1 when the random roll is at the bottom of the range", () => {
  const room = makeRoom(["Wrecker", "Other"]);
  after(() => cleanup(room));
  const wreckerPlayer = room.playerById("p0");
  wreckerPlayer.character = "Y";
  wreckerPlayer.abilityCooldown = 5;

  wreckerPlayer.position = 16;
  withFixedRandom(0, () => room.movePlayer(wreckerPlayer, 1)); // -> tile 17

  assert.equal(wreckerPlayer.abilityCooldown, 4);
});

test("landing on 'عليكم الأمان' eases the cooldown by 4 when the random roll is at the top of the range", () => {
  const room = makeRoom(["Wrecker", "Other"]);
  after(() => cleanup(room));
  const wreckerPlayer = room.playerById("p0");
  wreckerPlayer.character = "Y";
  wreckerPlayer.abilityCooldown = 5;

  wreckerPlayer.position = 45;
  withFixedRandom(0.99, () => room.movePlayer(wreckerPlayer, 1)); // -> tile 46

  assert.equal(wreckerPlayer.abilityCooldown, 1);
});

test("landing on 'عليكم الأمان' can also ease the cooldown by the two middle values (2 and 3)", () => {
  const room = makeRoom(["Wrecker", "Other"]);
  after(() => cleanup(room));
  const wreckerPlayer = room.playerById("p0");
  wreckerPlayer.character = "Y";

  wreckerPlayer.abilityCooldown = 5;
  wreckerPlayer.position = 16;
  withFixedRandom(0.25, () => room.movePlayer(wreckerPlayer, 1)); // -> tile 17, reduction 2
  assert.equal(wreckerPlayer.abilityCooldown, 3);

  wreckerPlayer.abilityCooldown = 5;
  wreckerPlayer.position = 16;
  withFixedRandom(0.5, () => room.movePlayer(wreckerPlayer, 1)); // -> tile 17, reduction 3
  assert.equal(wreckerPlayer.abilityCooldown, 2);
});

test("the ease clamps at 0 -- never goes negative", () => {
  const room = makeRoom(["Wrecker", "Other"]);
  after(() => cleanup(room));
  const wreckerPlayer = room.playerById("p0");
  wreckerPlayer.character = "Y";
  wreckerPlayer.abilityCooldown = 1;

  wreckerPlayer.position = 16;
  withFixedRandom(0.99, () => room.movePlayer(wreckerPlayer, 1)); // would-be reduction of 4, only 1 to give

  assert.equal(wreckerPlayer.abilityCooldown, 0);
});

test("no effect on a player with no character selected", () => {
  const room = makeRoom(["Other", "Third"]);
  after(() => cleanup(room));
  const player = room.playerById("p0");
  player.position = 16;
  // Should simply not throw / not touch anything character-related.
  room.movePlayer(player, 1);
  assert.equal(player.character, null);
});

test("no effect when the cooldown is already 0", () => {
  const room = makeRoom(["Wrecker", "Other"]);
  after(() => cleanup(room));
  const wreckerPlayer = room.playerById("p0");
  wreckerPlayer.character = "Y";
  wreckerPlayer.abilityCooldown = 0;
  wreckerPlayer.position = 16;
  room.movePlayer(wreckerPlayer, 1);
  assert.equal(wreckerPlayer.abilityCooldown, 0);
});

test("tile 24 ('استراحة محارب') also eases cooldowns, same as 'عليكم الأمان' -- both names are scoped in", () => {
  const room = makeRoom(["Wrecker", "Other"]);
  after(() => cleanup(room));
  const wreckerPlayer = room.playerById("p0");
  wreckerPlayer.character = "Y";
  wreckerPlayer.abilityCooldown = 5;
  wreckerPlayer.position = 23;

  withFixedRandom(0.99, () => room.movePlayer(wreckerPlayer, 1)); // -> tile 24

  assert.equal(wreckerPlayer.abilityCooldown, 1, "eased by 4, same range and mechanic as 'عليكم الأمان'");
});

test("the vacation-pot payout still applies on 'عليكم الأمان' tiles alongside the cooldown ease", () => {
  const room = makeRoom(["Wrecker", "Other"]);
  after(() => cleanup(room));
  const wreckerPlayer = room.playerById("p0");
  wreckerPlayer.character = "Y";
  wreckerPlayer.abilityCooldown = 5;
  room.vacationPot = 100;

  const before = wreckerPlayer.balance;
  wreckerPlayer.position = 16;
  withFixedRandom(0, () => room.movePlayer(wreckerPlayer, 1));

  assert.equal(wreckerPlayer.balance, before + 100, "vacation pot payout is unaffected by the new mechanic");
  assert.equal(wreckerPlayer.abilityCooldown, 4);
  assert.equal(room.vacationPot, 0);
});
