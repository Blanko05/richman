import { test, after } from "node:test";
import assert from "node:assert/strict";
import { makeRoom, cleanup } from "./helpers.js";

// H -- The Kingpin. Passive: a shared landing counter across his turf zone
// (tiles 37/38/39/41/44/45/47); every 3rd landing (regardless of whether it
// pays rent) triggers a 90% bank-mediated cut, but only on landings that
// actually owe rent. Active: Hostile Takeover seizes an ownable tile for the
// rest of the round, then reverts exactly.

function ownTile(room, playerId, tileId, houses = 0) {
  room.ownership[tileId] = { ownerId: playerId, houses };
  room.playerById(playerId).properties.push(tileId);
}

test("passive: the 3rd landing on H's turf triggers a 90% cut, the 1st and 2nd don't", () => {
  const room = makeRoom(["Payer", "Owner", "Kingpin"]);
  after(() => cleanup(room));
  const payer = room.playerById("p0");
  const owner = room.playerById("p1");
  const kingpinPlayer = room.playerById("p2");
  kingpinPlayer.character = "H";
  ownTile(room, "p1", 37); // بابل -- H's turf

  const rent = room.calcRent(room._board[37], room.ownership[37]);
  const cut = Math.floor(rent * 0.9);

  // 1st landing -- just consumes one of the three, nothing else to check here
  payer.position = 36;
  room.movePlayer(payer, 1);
  assert.equal(kingpinPlayer.abilityState.landingCount, 1);

  // 2nd landing
  payer.position = 36;
  const beforeOwner2 = owner.balance;
  const beforeKingpin2 = kingpinPlayer.balance;
  room.movePlayer(payer, 1);
  assert.equal(owner.balance, beforeOwner2 + rent, "2nd landing: full rent, no cut yet");
  assert.equal(kingpinPlayer.balance, beforeKingpin2, "2nd landing: H gets nothing yet");

  // 3rd landing -- the cut triggers
  payer.position = 36;
  const beforeOwner3 = owner.balance;
  const beforeKingpin3 = kingpinPlayer.balance;
  room.movePlayer(payer, 1);
  assert.equal(owner.balance, beforeOwner3 + rent - cut, "3rd landing: owner's earnings are cut");
  assert.equal(kingpinPlayer.balance, beforeKingpin3 + cut, "3rd landing: H collects the 90% cut");
});

test("passive: a landing with no rent due (unowned tile) still consumes one of the 3, but has nothing to cut", () => {
  const room = makeRoom(["Payer", "Kingpin"]);
  after(() => cleanup(room));
  const payer = room.playerById("p0");
  const kingpinPlayer = room.playerById("p1");
  kingpinPlayer.character = "H";
  // tile 37 unowned -- lands 3 times, each triggers awaitBuy/declineBuy so the
  // tile stays unowned and rent is never actually due.
  for (let i = 0; i < 3; i++) {
    payer.position = 36;
    room.movePlayer(payer, 1);
    room.declineBuy("p0");
  }
  assert.equal(kingpinPlayer.abilityState.landingCount, 3);
  assert.equal(kingpinPlayer.balance, 1500, "nothing to cut on an unowned landing, even on the 3rd");
});

test("passive: no cut outside H's zone", () => {
  const room = makeRoom(["Payer", "Owner", "Kingpin"]);
  after(() => cleanup(room));
  const payer = room.playerById("p0");
  const owner = room.playerById("p1");
  const kingpinPlayer = room.playerById("p2");
  kingpinPlayer.character = "H";
  ownTile(room, "p1", 1); // pink, not H's turf

  for (let i = 0; i < 3; i++) {
    payer.position = 0;
    room.movePlayer(payer, 1);
  }

  assert.equal(kingpinPlayer.balance, 1500, "no cut ever -- outside H's zone entirely");
});

test("active: Hostile Takeover seizes an owned tile and reverts to the original owner at round end", () => {
  const room = makeRoom(["Kingpin", "Owner", "Third"]);
  after(() => cleanup(room));
  const kingpinPlayer = room.playerById("p0");
  const owner = room.playerById("p1");
  kingpinPlayer.character = "H";
  ownTile(room, "p1", 1, 2); // developed -- houses must survive the round-trip

  const result = room.useAbility("p0", { tileId: 1 });
  assert.deepEqual(result, { ok: true, tileId: 1 });
  assert.equal(kingpinPlayer.abilityCooldown, 7);
  assert.equal(room.ownership[1].ownerId, "p0");
  assert.equal(room.ownership[1].houses, 2, "development is preserved, not wiped");
  assert.ok(kingpinPlayer.properties.includes(1));
  assert.ok(!owner.properties.includes(1));

  room.endTurn(); // p0 -> p1
  room.endTurn(); // p1 -> p2
  room.endTurn(); // p2 -> p0 (wraps, round ends, takeover reverts)

  assert.equal(room.ownership[1].ownerId, "p1", "reverted to the original owner");
  assert.equal(room.ownership[1].houses, 2);
  assert.ok(owner.properties.includes(1));
  assert.ok(!kingpinPlayer.properties.includes(1));
});

test("active: Hostile Takeover on an unowned tile reverts to unowned again", () => {
  const room = makeRoom(["Kingpin", "Other", "Third"]);
  after(() => cleanup(room));
  const kingpinPlayer = room.playerById("p0");
  kingpinPlayer.character = "H";

  room.useAbility("p0", { tileId: 5 }); // مدينة الكويت, unowned
  assert.equal(room.ownership[5].ownerId, "p0");

  room.endTurn();
  room.endTurn();
  room.endTurn();

  assert.equal(room.ownership[5], undefined, "back to unowned, not left assigned to H");
  assert.ok(!kingpinPlayer.properties.includes(5));
});

test("active: Hostile Takeover rejects a tile H already controls", () => {
  const room = makeRoom(["Kingpin", "Other"]);
  after(() => cleanup(room));
  const kingpinPlayer = room.playerById("p0");
  kingpinPlayer.character = "H";
  ownTile(room, "p0", 1);

  const result = room.useAbility("p0", { tileId: 1 });
  assert.equal(result.error, "You already control this tile");
});

test("active: Hostile Takeover rejects a non-ownable tile", () => {
  const room = makeRoom(["Kingpin", "Other"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "H";
  const result = room.useAbility("p0", { tileId: 4 }); // a tax tile
  assert.equal(result.error, "Invalid target");
});
