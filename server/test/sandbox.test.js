import { test, after } from "node:test";
import assert from "node:assert/strict";
import { makeRoom, cleanup } from "./helpers.js";
import { Room } from "../src/game/Room.js";

// Sandbox rooms (server/src/index.js's createSandboxRoom) are a dev-only
// testing harness -- `room.mode` is still "characters" for state consistency
// (see Room.js), so `isSandbox` is the only thing that actually distinguishes
// one from a real characters-mode game. useAbility skips arming a cooldown
// entirely when it's set, so every active stays spammable for testing.

test("useAbility never arms a cooldown in a sandbox room, even across repeated casts on the same turn", () => {
  const room = makeRoom(["Don", "Other"]);
  after(() => cleanup(room));
  room.isSandbox = true;
  const donPlayer = room.playerById("p0");
  donPlayer.character = "D";

  const first = room.useAbility("p0", { tileId: 4 });
  assert.equal(first.ok, true);
  assert.equal(donPlayer.abilityCooldown, 0, "no cooldown armed after a successful cast in sandbox");

  // A barricade is a one-shot trap -- move the trapped-away wall out of the
  // way first so this second cast isn't just re-placing the same one.
  room.playerById("p1").position = 0;
  room.movePlayer(room.playerById("p1"), 4); // springs and clears the first barricade

  const second = room.useAbility("p0", { tileId: 8 });
  assert.equal(second.ok, true, "still usable immediately -- no cooldown ever blocked it");
  assert.equal(donPlayer.abilityCooldown, 0);
});

test("useAbility still arms a real cooldown in a non-sandbox characters-mode room", () => {
  const room = makeRoom(["Don", "Other"]);
  after(() => cleanup(room));
  assert.equal(room.isSandbox, false, "default -- only createSandboxRoom ever sets this true");
  const donPlayer = room.playerById("p0");
  donPlayer.character = "D";

  const result = room.useAbility("p0", { tileId: 4 });
  assert.equal(result.ok, true);
  assert.equal(donPlayer.abilityCooldown, 10, "normal 10-turn Barricade cooldown, unaffected");
});

test("isSandbox survives a toSnapshot/fromSnapshot round-trip (server restart)", () => {
  const room = makeRoom(["Don"]);
  after(() => cleanup(room));
  room.isSandbox = true;

  const restored = Room.fromSnapshot(room.toSnapshot());
  after(() => cleanup(restored));
  assert.equal(restored.isSandbox, true, "a restart shouldn't silently re-enable cooldowns in a sandbox room");
});
