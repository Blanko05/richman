import { test, after } from "node:test";
import assert from "node:assert/strict";
import { makeRoom, cleanup } from "./helpers.js";

// D -- The Don. Passive: 30% bank-mediated cut of rent in his turf zone
// (tiles 13/14/16), 50% bank-mediated cut of any tax payment. Active:
// Barricade -- a tile-wide wall for the rest of the round, forward-movement
// interception only (decisions.md).

function ownTile(room, playerId, tileId, houses = 0) {
  room.ownership[tileId] = { ownerId: playerId, houses };
  room.playerById(playerId).properties.push(tileId);
}

test("passive: 30% turf rent cut is deducted from the owner, payer pays full normal rent", () => {
  const room = makeRoom(["Payer", "Owner", "Don"]);
  after(() => cleanup(room));
  const payer = room.playerById("p0");
  const owner = room.playerById("p1");
  const donPlayer = room.playerById("p2");
  donPlayer.character = "D";
  ownTile(room, "p1", 13); // اغوار الشمال -- D's turf

  const rent = room.calcRent(room._board[13], room.ownership[13]);
  const cut = Math.floor(rent * 0.3);
  const payerBefore = payer.balance;
  const ownerBefore = owner.balance;
  const donBefore = donPlayer.balance;

  payer.position = 12;
  room.movePlayer(payer, 1); // lands exactly on 13

  assert.equal(payer.balance, payerBefore - rent, "payer pays the full, uncut rent");
  assert.equal(owner.balance, ownerBefore + rent - cut, "owner's earnings are the ones reduced");
  assert.equal(donPlayer.balance, donBefore + cut);
});

test("passive: no turf cut outside D's zone", () => {
  const room = makeRoom(["Payer", "Owner", "Don"]);
  after(() => cleanup(room));
  const owner = room.playerById("p1");
  const donPlayer = room.playerById("p2");
  donPlayer.character = "D";
  ownTile(room, "p1", 1); // سحاب -- pink, not D's turf

  const rent = room.calcRent(room._board[1], room.ownership[1]);
  const donBefore = donPlayer.balance;
  const ownerBefore = owner.balance;

  room.playerById("p0").position = 0;
  room.movePlayer(room.playerById("p0"), 1); // lands exactly on 1

  assert.equal(owner.balance, ownerBefore + rent, "owner keeps the full rent -- outside D's turf");
  assert.equal(donPlayer.balance, donBefore, "D takes no cut outside his zone");
});

test("passive: D owning his own turf tile nets no extra cut -- he just keeps the full rent as owner", () => {
  const room = makeRoom(["Payer", "Don"]);
  after(() => cleanup(room));
  const donPlayer = room.playerById("p1");
  donPlayer.character = "D";
  ownTile(room, "p1", 13);

  const rent = room.calcRent(room._board[13], room.ownership[13]);
  const donBefore = donPlayer.balance;

  const payer = room.playerById("p0");
  payer.position = 12;
  room.movePlayer(payer, 1);

  assert.equal(donPlayer.balance, donBefore + rent, "self-owned turf: full rent, no additional cut on top");
});

test("passive: 50% tax cut is bank-mediated, taxed player pays the normal amount unaffected", () => {
  const room = makeRoom(["Taxed", "Don"]);
  after(() => cleanup(room));
  const taxed = room.playerById("p0");
  const donPlayer = room.playerById("p1");
  donPlayer.character = "D";

  const taxedBefore = taxed.balance;
  const donBefore = donPlayer.balance;

  taxed.position = 3;
  room.movePlayer(taxed, 1); // tile 4, tax tile, amount 100

  assert.equal(taxed.balance, taxedBefore - 100);
  assert.equal(donPlayer.balance, donBefore + 50);
});

test("active: Barricade stops forward movement short and resolves the barricaded tile's own action, no extra toll", () => {
  const room = makeRoom(["Don", "Mover"]);
  after(() => cleanup(room));
  const donPlayer = room.playerById("p0");
  donPlayer.character = "D";

  const result = room.useAbility("p0", { tileId: 4 }); // a tax tile, amount 100
  assert.deepEqual(result, { ok: true, tileId: 4 });
  assert.equal(donPlayer.abilityCooldown, 10);

  const mover = room.playerById("p1");
  mover.position = 0;
  const before = mover.balance;
  const seqBefore = room.barricadeSeq;

  room.movePlayer(mover, 10); // would normally land on tile 10, barricade is at 4

  assert.equal(mover.position, 4, "stopped short at the barricaded tile");
  assert.equal(mover.balance, before - 100, "only the barricaded tile's own normal charge -- no extra toll");
  assert.equal(room.barricadeSeq, seqBefore + 1);
  assert.deepEqual(room.lastBarricadeStop, { playerId: "p1", tileId: 4, fromTileId: 0 });
});

test("active: Barricade is a one-shot trap -- it deactivates the instant it catches its first player", () => {
  const room = makeRoom(["Don", "First", "Second"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "D";
  room.useAbility("p0", { tileId: 4 }); // a tax tile

  const first = room.playerById("p1");
  first.position = 0;
  room.movePlayer(first, 10); // would normally land on tile 10, barricade at 4
  assert.equal(first.position, 4, "first player is trapped");
  assert.equal(room.barricade, null, "the wall deactivates immediately after catching someone");

  const second = room.playerById("p2");
  second.position = 0;
  room.movePlayer(second, 10);
  assert.equal(second.position, 10, "second player passes through freely -- the trap already sprang");
});

test("active: Barricade lets movement through untouched when the roll doesn't reach it", () => {
  const room = makeRoom(["Don", "Mover"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "D";
  room.useAbility("p0", { tileId: 20 });

  const mover = room.playerById("p1");
  mover.position = 0;
  room.movePlayer(mover, 5); // tile 5, nowhere near tile 20

  assert.equal(mover.position, 5);
});

test("active: Barricade also stops D's own movement -- no exemption for the caster", () => {
  const room = makeRoom(["Don", "Other"]);
  after(() => cleanup(room));
  const donPlayer = room.playerById("p0");
  donPlayer.character = "D";
  room.useAbility("p0", { tileId: 4 });

  donPlayer.position = 0;
  room.movePlayer(donPlayer, 10);

  assert.equal(donPlayer.position, 4);
});

test("active: Barricade is scoped to forward movement only -- a backward card move ignores it", () => {
  const room = makeRoom(["Don", "Mover"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "D";
  room.useAbility("p0", { tileId: 4 });

  const mover = room.playerById("p1");
  mover.position = 6;
  room.movePlayer(mover, -2); // backward past tile 4 -- must not be intercepted

  assert.equal(mover.position, 4, "same tile the barricade sits on, but reached going backward -- unaffected either way");
  // Stronger check: a backward move that passes through tile 4 without landing on it.
  const room2 = makeRoom(["Don", "Mover"]);
  after(() => cleanup(room2));
  room2.playerById("p0").character = "D";
  room2.useAbility("p0", { tileId: 4 });
  const mover2 = room2.playerById("p1");
  mover2.position = 8;
  room2.movePlayer(mover2, -6); // would pass tile 4 on the way to tile 2, moving backward
  assert.equal(mover2.position, 2, "backward movement is never intercepted, even passing through the barricaded tile");
});

test("active: a barricade wraps past Start correctly and still pays the pass-Start bonus when applicable", () => {
  const room = makeRoom(["Don", "Mover"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "D";
  room.useAbility("p0", { tileId: 1 }); // unowned property -- lands as a no-op awaitBuy, no card-draw noise

  const mover = room.playerById("p1");
  mover.position = 46;
  const before = mover.balance;
  room.movePlayer(mover, 10); // normally 46+10=56 % 48 = 8, but barricade at 1 cuts it short, wrapping past Start

  assert.equal(mover.position, 1);
  assert.equal(mover.balance, before + 200, "still collects the pass-Start bonus for wrapping through it");
});

test("active: Barricade expires at the end of the round it was placed in", () => {
  const room = makeRoom(["Don", "Mover", "Third"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "D";
  room.useAbility("p0", { tileId: 4 });
  assert.ok(room.barricade);

  room.endTurn(); // p0 -> p1
  room.endTurn(); // p1 -> p2
  room.endTurn(); // p2 -> p0 (wraps, round increments, barricade should expire)
  assert.equal(room.barricade, null);

  const mover = room.playerById("p1");
  mover.position = 0;
  room.movePlayer(mover, 10);
  assert.equal(mover.position, 10, "no longer intercepted -- barricade already expired");
});
