import { test, after } from "node:test";
import assert from "node:assert/strict";
import { makeRoom, cleanup } from "./helpers.js";

// SD -- The Conductor. Passive: double rent if SD owns the landed station,
// else a flat $50 direct toll (regardless of whether the station is owned by
// someone else or unowned). Active: Wrecking Tour sweeps from SD's position
// to tile 6, demolishing up to 2 levels per property along the way.

function ownTile(room, playerId, tileId, houses = 0) {
  room.ownership[tileId] = { ownerId: playerId, houses };
  room.playerById(playerId).properties.push(tileId);
}

test("passive: landing on SD's own station doubles the rent, no separate toll", () => {
  const room = makeRoom(["Payer", "Conductor"]);
  after(() => cleanup(room));
  const payer = room.playerById("p0");
  const conductorPlayer = room.playerById("p1");
  conductorPlayer.character = "SD";
  ownTile(room, "p1", 6); // محطة الكوستر

  const baseRent = room._board[6].rent[0];
  const payerBefore = payer.balance;
  const conductorBefore = conductorPlayer.balance;

  payer.position = 5;
  room.movePlayer(payer, 1); // lands exactly on 6

  assert.equal(payer.balance, payerBefore - baseRent * 2, "rent is doubled");
  assert.equal(conductorPlayer.balance, conductorBefore + baseRent * 2, "SD collects the doubled rent, nothing extra");
});

test("passive: landing on a station owned by someone else pays normal rent PLUS a flat $50 toll to SD", () => {
  const room = makeRoom(["Payer", "Owner", "Conductor"]);
  after(() => cleanup(room));
  const payer = room.playerById("p0");
  const owner = room.playerById("p1");
  const conductorPlayer = room.playerById("p2");
  conductorPlayer.character = "SD";
  ownTile(room, "p1", 6);

  const rent = room._board[6].rent[0];
  const payerBefore = payer.balance;
  const ownerBefore = owner.balance;
  const conductorBefore = conductorPlayer.balance;

  payer.position = 5;
  room.movePlayer(payer, 1);

  assert.equal(payer.balance, payerBefore - rent - 50, "pays normal rent to the owner AND the $50 toll to SD");
  assert.equal(owner.balance, ownerBefore + rent, "real owner is unaffected by the toll -- gets their normal rent");
  assert.equal(conductorPlayer.balance, conductorBefore + 50);
});

test("passive: landing on an unowned station still charges SD's $50 toll, even with no rent owed to anyone", () => {
  const room = makeRoom(["Payer", "Conductor"]);
  after(() => cleanup(room));
  const payer = room.playerById("p0");
  const conductorPlayer = room.playerById("p1");
  conductorPlayer.character = "SD";

  const payerBefore = payer.balance;
  const conductorBefore = conductorPlayer.balance;

  payer.position = 5;
  room.movePlayer(payer, 1); // tile 6, unowned

  assert.equal(payer.balance, payerBefore - 50, "only the toll -- no rent, nobody owns it yet");
  assert.equal(conductorPlayer.balance, conductorBefore + 50);
  assert.equal(room.pendingAction?.type, "awaitBuy", "still gets the normal buy prompt for the unowned station");
});

test("passive: no toll or doubling for non-station tiles", () => {
  const room = makeRoom(["Payer", "Owner", "Conductor"]);
  after(() => cleanup(room));
  const payer = room.playerById("p0");
  const owner = room.playerById("p1");
  const conductorPlayer = room.playerById("p2");
  conductorPlayer.character = "SD";
  ownTile(room, "p1", 1); // پink property, not a station

  const rent = room.calcRent(room._board[1], room.ownership[1]);
  const conductorBefore = conductorPlayer.balance;
  payer.position = 0;
  room.movePlayer(payer, 1);

  assert.equal(conductorPlayer.balance, conductorBefore, "SD's passive is scoped to stations only");
});

test("active: Wrecking Tour demolishes up to 2 levels per property from SD's position to tile 6", () => {
  const room = makeRoom(["Conductor", "VictimA", "VictimB"]);
  after(() => cleanup(room));
  const conductorPlayer = room.playerById("p0");
  conductorPlayer.character = "SD";
  conductorPlayer.position = 3; // path: 4(tax),5(prop,unowned),6(destination, station)
  ownTile(room, "p1", 5, 1); // only 1 level -- clamps to 1 removed, not 2

  const result = room.useAbility("p0", {});
  assert.deepEqual(result, { ok: true, tilesPassed: 3, totalLevelsRemoved: 1 });
  assert.equal(room.ownership[5].houses, 0);
  assert.equal(conductorPlayer.abilityCooldown, 8);
});

test("active: Wrecking Tour sets room-wide broadcast state so every client (not just the caster) can animate it", () => {
  const room = makeRoom(["Conductor", "Victim"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "SD";
  room.playerById("p0").position = 3; // path: 4,5,6
  ownTile(room, "p1", 5, 1);

  assert.equal(room.wreckingTourSeq, 0);
  room.useAbility("p0", {});

  assert.equal(room.wreckingTourSeq, 1);
  assert.deepEqual(room.lastWreckingTour, {
    casterId: "p0",
    startTileId: 3,
    path: [4, 5, 6],
    demolished: [{ tileId: 5, levelsRemoved: 1 }],
  });
});

test("active: Wrecking Tour clamps at 2 levels even if a property has more, and covers multiple properties", () => {
  const room = makeRoom(["Conductor", "VictimA"]);
  after(() => cleanup(room));
  const conductorPlayer = room.playerById("p0");
  conductorPlayer.character = "SD";
  conductorPlayer.position = 0; // path: 1(prop),2(card),3(prop),4(tax),5(prop),6(destination)
  ownTile(room, "p1", 1, 4);
  ownTile(room, "p1", 3, 2);
  ownTile(room, "p1", 5, 0); // empty -- nothing to remove

  const result = room.useAbility("p0", {});
  assert.equal(result.ok, true);
  assert.equal(room.ownership[1].houses, 2, "clamped: 4 - 2 = 2");
  assert.equal(room.ownership[3].houses, 0, "2 - 2 = 0");
  assert.equal(room.ownership[5].houses, 0, "already empty, untouched");
  assert.equal(result.totalLevelsRemoved, 4); // 2 from tile 1 + 2 from tile 3
});

test("active: Wrecking Tour skips SD's own properties along the path -- only demolishes other players'", () => {
  const room = makeRoom(["Conductor", "Victim"]);
  after(() => cleanup(room));
  const conductorPlayer = room.playerById("p0");
  conductorPlayer.character = "SD";
  conductorPlayer.position = 0; // path: 1(prop),2(card),3(prop),4(tax),5(prop),6(destination)
  ownTile(room, "p0", 1, 3); // SD's own -- must survive untouched
  ownTile(room, "p1", 3, 2); // someone else's -- still gets demolished

  const result = room.useAbility("p0", {});
  assert.equal(result.ok, true);
  assert.equal(room.ownership[1].houses, 3, "SD's own property is skipped entirely");
  assert.equal(room.ownership[3].houses, 0, "another player's property on the same path is still torn down");
  assert.deepEqual(result, { ok: true, tilesPassed: 6, totalLevelsRemoved: 2 }, "SD's own 3 levels don't count toward the total either");
});

test("active: Wrecking Tour wraps around the board loop if SD's position is past tile 6", () => {
  const room = makeRoom(["Conductor", "VictimA"]);
  after(() => cleanup(room));
  const conductorPlayer = room.playerById("p0");
  conductorPlayer.character = "SD";
  conductorPlayer.position = 45; // path wraps: 46,47,0,1,2,3,4,5,6 (9 tiles)
  ownTile(room, "p1", 47, 1);

  const result = room.useAbility("p0", {});
  assert.equal(result.tilesPassed, 9);
  assert.equal(room.ownership[47].houses, 0);
});

test("active: Wrecking Tour ends the tour AT the destination tile, paying rent there like a real landing", () => {
  const room = makeRoom(["Conductor", "Owner"]);
  after(() => cleanup(room));
  const conductorPlayer = room.playerById("p0");
  const owner = room.playerById("p1");
  conductorPlayer.character = "SD";
  conductorPlayer.position = 3; // path: 4,5,6
  ownTile(room, "p1", 6); // destination station, owned by someone else

  const rent = room.calcRent(room._board[6], room.ownership[6]);
  const conductorBefore = conductorPlayer.balance;
  const ownerBefore = owner.balance;

  room.useAbility("p0", {});

  assert.equal(conductorPlayer.position, 6, "SD actually ends up at the destination, not back where he started");
  assert.equal(conductorPlayer.balance, conductorBefore - rent, "and pays rent there like any real landing");
  assert.equal(owner.balance, ownerBefore + rent);
});

test("active: Wrecking Tour triggers a normal buy prompt if the destination station is unowned", () => {
  const room = makeRoom(["Conductor", "Other"]);
  after(() => cleanup(room));
  const conductorPlayer = room.playerById("p0");
  conductorPlayer.character = "SD";
  conductorPlayer.position = 3; // path: 4,5,6, destination unowned

  room.useAbility("p0", {});

  assert.equal(conductorPlayer.position, 6);
  assert.deepEqual(room.pendingAction, { type: "awaitBuy", tileId: 6, playerId: "p0" });
});

test("active: Wrecking Tour refuses to run while any pendingAction is already open, even one of your own from earlier this turn", () => {
  const room = makeRoom(["Conductor", "Other"]);
  after(() => cleanup(room));
  const conductorPlayer = room.playerById("p0");
  conductorPlayer.character = "SD";
  // SD's own turn lands him on an unowned tile, opening a real awaitBuy that's
  // still unresolved when he then tries Wrecking Tour -- abilities are
  // turn-gated now (only usable on your own turn), so the only way to exercise
  // this guard is with a still-open decision from earlier your own turn, not
  // someone else's.
  conductorPlayer.position = 0;
  room.movePlayer(conductorPlayer, 1);
  assert.equal(room.pendingAction.type, "awaitBuy");
  const pendingBefore = { ...room.pendingAction };

  const result = room.useAbility("p0", {});

  assert.equal(result.error, "Resolve the current action first");
  assert.deepEqual(room.pendingAction, pendingBefore, "the still-open buy prompt is untouched");
  assert.equal(conductorPlayer.abilityCooldown, 0, "a rejected attempt arms no cooldown");
});

test("active: Wrecking Tour rejects a caster in the Holding Pen", () => {
  const room = makeRoom(["Conductor", "Other"]);
  after(() => cleanup(room));
  const conductorPlayer = room.playerById("p0");
  conductorPlayer.character = "SD";
  conductorPlayer.inHolding = true;

  const result = room.useAbility("p0", {});
  assert.equal(result.error, "Can't send out Wrecking Tour from the Holding Pen");
  assert.equal(conductorPlayer.abilityCooldown, 0, "a rejected attempt arms no cooldown");
});

test("active: Wrecking Tour also triggers Y's own demolish passive along the way", () => {
  const room = makeRoom(["Conductor", "Victim", "Wrecker"]);
  after(() => cleanup(room));
  const conductorPlayer = room.playerById("p0");
  const wreckerPlayer = room.playerById("p2");
  conductorPlayer.character = "SD";
  wreckerPlayer.character = "Y";
  conductorPlayer.position = 4;
  ownTile(room, "p1", 5, 1);

  const before = wreckerPlayer.balance;
  room.useAbility("p0", {});
  assert.equal(wreckerPlayer.balance, before + 50);
});
