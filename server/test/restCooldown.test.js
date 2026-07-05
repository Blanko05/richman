import { test, after } from "node:test";
import assert from "node:assert/strict";
import { makeRoom, cleanup } from "./helpers.js";

// "عليكم الأمان" tiles (17, 46) ease the landing player's ability cooldown by
// a random 1-2 turns, clamped at 0. Tile 24 ("استراحة محارب") is REST too but
// a deliberately distinct flavor -- it keeps only the existing vacation-pot
// payout, unaffected by this mechanic (decisions.md).

function withFixedRandom(value, fn) {
  const orig = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = orig;
  }
}

test("landing on 'عليكم الأمان' eases the cooldown by 1 when the random roll is low", () => {
  const room = makeRoom(["Wrecker", "Other"]);
  after(() => cleanup(room));
  const wreckerPlayer = room.playerById("p0");
  wreckerPlayer.character = "Y";
  wreckerPlayer.abilityCooldown = 5;

  wreckerPlayer.position = 16;
  withFixedRandom(0, () => room.movePlayer(wreckerPlayer, 1)); // -> tile 17

  assert.equal(wreckerPlayer.abilityCooldown, 4);
});

test("landing on 'عليكم الأمان' eases the cooldown by 2 when the random roll is high", () => {
  const room = makeRoom(["Wrecker", "Other"]);
  after(() => cleanup(room));
  const wreckerPlayer = room.playerById("p0");
  wreckerPlayer.character = "Y";
  wreckerPlayer.abilityCooldown = 5;

  wreckerPlayer.position = 45;
  withFixedRandom(0.99, () => room.movePlayer(wreckerPlayer, 1)); // -> tile 46

  assert.equal(wreckerPlayer.abilityCooldown, 3);
});

test("the ease clamps at 0 -- never goes negative", () => {
  const room = makeRoom(["Wrecker", "Other"]);
  after(() => cleanup(room));
  const wreckerPlayer = room.playerById("p0");
  wreckerPlayer.character = "Y";
  wreckerPlayer.abilityCooldown = 1;

  wreckerPlayer.position = 16;
  withFixedRandom(0.99, () => room.movePlayer(wreckerPlayer, 1)); // would-be reduction of 2, only 1 to give

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

test("tile 24 ('استراحة محارب') is REST too but does NOT ease cooldowns -- name-scoped, not type-scoped", () => {
  const room = makeRoom(["Wrecker", "Other"]);
  after(() => cleanup(room));
  const wreckerPlayer = room.playerById("p0");
  wreckerPlayer.character = "Y";
  wreckerPlayer.abilityCooldown = 5;
  wreckerPlayer.position = 23;

  withFixedRandom(0.99, () => room.movePlayer(wreckerPlayer, 1)); // -> tile 24

  assert.equal(wreckerPlayer.abilityCooldown, 5, "unaffected -- only the two 'عليكم الأمان'-named tiles ease cooldowns");
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
