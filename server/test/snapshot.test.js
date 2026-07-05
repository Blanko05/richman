import { test, after } from "node:test";
import assert from "node:assert/strict";
import { Room } from "../src/game/Room.js";
import { makeRoom, cleanup } from "./helpers.js";

// Room.fromSnapshot rebuilds a Room after a server restart (see the persisted
// rooms.json flow in server/src/index.js). A player mid-disconnect-grace when
// the snapshot was taken used to get kicked outright on restore; they now get
// a fresh full grace window instead, same "fresh full duration" treatment the
// turn/auction timers already get a few lines above this in fromSnapshot.

test("a mid-disconnect-grace player gets a fresh grace window on restart, not kicked outright", () => {
  const room = makeRoom(["Alice", "Bob"]);
  after(() => cleanup(room));
  const alice = room.players[0];
  alice.connected = false; // simulates the live disconnect handler's startGracePeriod having already fired

  const snapshot = room.toSnapshot();
  const restored = Room.fromSnapshot(snapshot);
  after(() => cleanup(restored));

  const restoredAlice = restored.players[0];
  assert.equal(restoredAlice.left, false, "not kicked on restore");
  assert.equal(restoredAlice.connected, false, "still shown as disconnected until they actually rejoin");
  assert.notEqual(restoredAlice.graceTimer, null, "a fresh grace timer is armed");
});

test("a connected player is unaffected by restore", () => {
  const room = makeRoom(["Alice", "Bob"]);
  after(() => cleanup(room));

  const snapshot = room.toSnapshot();
  const restored = Room.fromSnapshot(snapshot);
  after(() => cleanup(restored));

  const restoredAlice = restored.players[0];
  assert.equal(restoredAlice.left, false);
  assert.equal(restoredAlice.connected, true);
  assert.equal(restoredAlice.graceTimer, null, "no grace timer needed -- they were never disconnected");
});
