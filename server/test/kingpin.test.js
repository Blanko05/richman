import { test, after } from "node:test";
import assert from "node:assert/strict";
import { makeRoom, cleanup } from "./helpers.js";

// H -- The Kingpin. Passive: a shared landing counter across his turf zone
// (tiles 37/38/39/41/44/45/47); every 2nd landing (regardless of whether it
// pays rent) triggers a 90% bank-mediated cut, but only on landings that
// actually owe rent. Active: Hostile Takeover seizes an ownable tile until
// H's own next turn comes around, then reverts exactly. (Passive frequency
// and active cooldown both buffed from every-3rd/6-turn -- playtesting found
// H the weakest character; see characters.md.)

function ownTile(room, playerId, tileId, houses = 0) {
  room.ownership[tileId] = { ownerId: playerId, houses };
  room.playerById(playerId).properties.push(tileId);
}

test("passive: the 2nd landing on H's turf triggers a 90% cut, the 1st doesn't", () => {
  const room = makeRoom(["Payer", "Owner", "Kingpin"]);
  after(() => cleanup(room));
  const payer = room.playerById("p0");
  const owner = room.playerById("p1");
  const kingpinPlayer = room.playerById("p2");
  kingpinPlayer.character = "H";
  ownTile(room, "p1", 37); // بابل -- H's turf

  const rent = room.calcRent(room._board[37], room.ownership[37]);
  const cut = Math.floor(rent * 0.9);

  // 1st landing -- just consumes one of the two, nothing else to check here
  payer.position = 36;
  room.movePlayer(payer, 1);
  assert.equal(kingpinPlayer.abilityState.landingCount, 1);

  // 2nd landing -- the cut triggers
  payer.position = 36;
  const beforeOwner2 = owner.balance;
  const beforeKingpin2 = kingpinPlayer.balance;
  room.movePlayer(payer, 1);
  assert.equal(owner.balance, beforeOwner2 + rent - cut, "2nd landing: owner's earnings are cut");
  assert.equal(kingpinPlayer.balance, beforeKingpin2 + cut, "2nd landing: H collects the 90% cut");
});

test("passive: a landing with no rent due (unowned tile) still consumes one of the 2, but has nothing to cut", () => {
  const room = makeRoom(["Payer", "Kingpin"]);
  after(() => cleanup(room));
  const payer = room.playerById("p0");
  const kingpinPlayer = room.playerById("p1");
  kingpinPlayer.character = "H";
  // tile 37 unowned -- lands twice, each triggers awaitBuy/declineBuy so the
  // tile stays unowned and rent is never actually due.
  for (let i = 0; i < 2; i++) {
    payer.position = 36;
    room.movePlayer(payer, 1);
    room.declineBuy("p0");
  }
  assert.equal(kingpinPlayer.abilityState.landingCount, 2);
  assert.equal(kingpinPlayer.balance, 1500, "nothing to cut on an unowned landing, even on the 2nd");
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

test("active: Hostile Takeover seizes an owned tile and reverts to the original owner once H's own next turn comes around", () => {
  const room = makeRoom(["Kingpin", "Owner", "Third"]);
  after(() => cleanup(room));
  const kingpinPlayer = room.playerById("p0");
  const owner = room.playerById("p1");
  kingpinPlayer.character = "H";
  ownTile(room, "p1", 1, 2); // developed -- houses must survive the round-trip

  const result = room.useAbility("p0", { tileId: 1 });
  assert.deepEqual(result, { ok: true, tileId: 1 });
  assert.equal(kingpinPlayer.abilityCooldown, 4);
  assert.equal(room.ownership[1].ownerId, "p0");
  assert.equal(room.ownership[1].houses, 2, "development is preserved, not wiped");
  assert.ok(kingpinPlayer.properties.includes(1));
  assert.ok(!owner.properties.includes(1));

  room.endTurn(); // p0 -> p1
  assert.equal(room.ownership[1].ownerId, "p0", "still H's -- not p1's own turn yet");
  room.endTurn(); // p1 -> p2
  assert.equal(room.ownership[1].ownerId, "p0", "still H's -- not p2's own turn yet either");
  room.endTurn(); // p2 -> p0 (H's own turn again -- takeover reverts)

  assert.equal(room.ownership[1].ownerId, "p1", "reverted to the original owner");
  assert.equal(room.ownership[1].houses, 2);
  assert.ok(owner.properties.includes(1));
  assert.ok(!kingpinPlayer.properties.includes(1));
});

test("active: Hostile Takeover grants control, not full ownership rights -- build/sell/mortgage are all rejected on a seized tile", () => {
  const room = makeRoom(["Kingpin", "Owner"]);
  after(() => cleanup(room));
  const kingpinPlayer = room.playerById("p0");
  kingpinPlayer.character = "H";
  ownTile(room, "p1", 1, 1); // one house already built, unmortgaged

  room.useAbility("p0", { tileId: 1 });
  assert.equal(room.ownership[1].ownerId, "p0", "seized -- ownerId genuinely changes");

  assert.equal(room.buyHouse("p0", 1).error, "A seized tile can't be built on");
  assert.equal(room.sellHouse("p0", 1).error, "A seized tile can't be sold from");
  assert.equal(room.mortgageProperty("p0", 1).error, "A seized tile can't be mortgaged");
  assert.equal(room.ownership[1].houses, 1, "none of the rejected calls actually changed anything");
});

test("active: seizing the last tile of a group doesn't let the seizer temporarily build there via the completed group (playtesting bug)", () => {
  const room = makeRoom(["Kingpin", "Owner"]);
  after(() => cleanup(room));
  const kingpinPlayer = room.playerById("p0");
  kingpinPlayer.character = "H";
  // "olive" -- tiles 10, 11. H genuinely owns 10; 11 belongs to someone else.
  ownTile(room, "p0", 10);
  ownTile(room, "p1", 11);

  room.useAbility("p0", { tileId: 11 }); // seizes the group's other tile
  assert.equal(room.ownership[11].ownerId, "p0", "ownership map genuinely flips -- this is what the bug exploited");

  // Building on the seized tile itself is already rejected (separate check).
  // The bug was that building on tile 10 -- the tile H legitimately owns --
  // was still allowed, since `ownsAll` alone couldn't tell a real full-group
  // hold apart from a temporary seizure filling in the last slot.
  const result = room.buyHouse("p0", 10);
  assert.equal(result.error, "You must own the full color group");
  assert.equal(room.ownership[10].houses, 0, "no house actually got built");
});

test("active: Hostile Takeover also blocks paying off a mortgage that predates the seizure", () => {
  const room = makeRoom(["Kingpin", "Owner"]);
  after(() => cleanup(room));
  const kingpinPlayer = room.playerById("p0");
  kingpinPlayer.character = "H";
  ownTile(room, "p1", 1);
  room.ownership[1].mortgaged = true;

  room.useAbility("p0", { tileId: 1 });
  assert.equal(room.ownership[1].mortgaged, true, "Hostile Takeover preserves the mortgage state as-is");

  const result = room.unmortgageProperty("p0", 1);
  assert.equal(result.error, "A seized tile can't be unmortgaged");
});

test("active: build/sell rights on a formerly-seized tile work normally again once it reverts", () => {
  const room = makeRoom(["Kingpin", "Owner", "Third"]);
  after(() => cleanup(room));
  const kingpinPlayer = room.playerById("p0");
  kingpinPlayer.character = "H";
  ownTile(room, "p1", 1, 1);

  room.useAbility("p0", { tileId: 1 });
  room.endTurn(); // p0 -> p1
  room.endTurn(); // p1 -> p2
  room.endTurn(); // p2 -> p0 (H's own turn again -- reverts)

  assert.equal(room.ownership[1].ownerId, "p1", "back to the original owner");
  const result = room.sellHouse("p1", 1);
  assert.equal(result.ok, true, "rights are fully restored once it reverts");
});

test("active: Hostile Takeover lasts a full lap even when cast by the LAST seat in turn order -- not just until the next global round boundary", () => {
  // Regression: revert used to be gated on a global room.round counter, which
  // made a last-seat caster's own takeover revert the instant THEIR turn
  // ended (ending their turn is what wraps the seat pointer back to 0),
  // robbing them of almost the entire round other players got. Revert is now
  // caster-relative, so every caster gets the same full lap regardless of
  // seat position.
  const room = makeRoom(["First", "Second", "Kingpin"]);
  after(() => cleanup(room));
  const kingpinPlayer = room.playerById("p2"); // last seat
  kingpinPlayer.character = "H";
  room.turnIndex = 2; // it's H's turn
  room.useAbility("p2", { tileId: 5 }); // unowned

  room.endTurn(); // p2 -> p0 (wraps to seat 0 -- the OLD bug reverted it right here)
  assert.equal(room.ownership[5].ownerId, "p2", "still H's -- caster-relative expiry, not a global round boundary");
});

test("active: Hostile Takeover on an unowned tile reverts to unowned again", () => {
  const room = makeRoom(["Kingpin", "Other", "Third"]);
  after(() => cleanup(room));
  const kingpinPlayer = room.playerById("p0");
  kingpinPlayer.character = "H";

  room.useAbility("p0", { tileId: 5 }); // مدينة الكويت, unowned
  assert.equal(room.ownership[5].ownerId, "p0");

  room.endTurn(); // p0 -> p1
  room.endTurn(); // p1 -> p2
  room.endTurn(); // p2 -> p0 (H's own turn again -- reverts)

  assert.equal(room.ownership[5], undefined, "back to unowned, not left assigned to H");
  assert.ok(!kingpinPlayer.properties.includes(5));
});

test("active: if the previous owner left mid-seizure, the tile reverts to unowned instead of being handed back to them (playtesting bug)", () => {
  const room = makeRoom(["Kingpin", "Owner", "Third"]);
  after(() => cleanup(room));
  const kingpinPlayer = room.playerById("p0");
  const owner = room.playerById("p1");
  kingpinPlayer.character = "H";
  ownTile(room, "p1", 1, 2);

  room.useAbility("p0", { tileId: 1 });
  room.kickPlayer("p1", "disconnected"); // the previous owner leaves while H still controls the tile

  room.endTurn(); // p0 -> p2 (p1 is left, skipped)
  room.endTurn(); // p2 -> p0 (H's own turn again -- reverts)

  assert.equal(room.ownership[1], undefined, "unowned, not handed back to the now-left previous owner");
  assert.ok(!owner.properties.includes(1), "the left player's own properties list is untouched by the revert");
});

test("active: if the previous owner went bankrupt mid-seizure, the tile reverts to unowned instead of being handed back to them", () => {
  const room = makeRoom(["Kingpin", "Owner", "Third"]);
  after(() => cleanup(room));
  const kingpinPlayer = room.playerById("p0");
  const owner = room.playerById("p1");
  kingpinPlayer.character = "H";
  ownTile(room, "p1", 1, 2);

  room.useAbility("p0", { tileId: 1 });
  owner.balance = -50;
  room.checkBankruptcy(owner); // the previous owner goes bankrupt while H still controls the tile

  room.endTurn(); // p0 -> p2 (p1 is bankrupt, skipped)
  room.endTurn(); // p2 -> p0 (H's own turn again -- reverts)

  assert.equal(room.ownership[1], undefined, "unowned, not handed back to the now-bankrupt previous owner");
});

test("active: damage done during the seizure (Y's Detonate) persists through the revert instead of being undone by the stale pre-seizure snapshot (playtesting bug)", () => {
  const room = makeRoom(["Kingpin", "Owner", "Wrecker"]);
  after(() => cleanup(room));
  const kingpinPlayer = room.playerById("p0");
  const owner = room.playerById("p1");
  const wreckerPlayer = room.playerById("p2");
  kingpinPlayer.character = "H";
  wreckerPlayer.character = "Y";
  ownTile(room, "p1", 1, 2); // developed, unmortgaged

  room.useAbility("p0", { tileId: 1 }); // H seizes it
  assert.equal(room.ownership[1].ownerId, "p0");

  room.endTurn(); // p0 -> p1
  room.endTurn(); // p1 -> p2 (Y's own turn -- abilities are turn-gated)

  // Y detonates the seized tile while H controls it -- fully wipes the
  // building, same as it would for any other owner.
  const detonateResult = room.useAbility("p2", { tileId: 1 });
  assert.deepEqual(detonateResult, { ok: true, levelsRemoved: 2 });
  assert.equal(room.ownership[1].houses, 0);

  room.endTurn(); // p2 -> p0 (H's own turn again -- reverts)

  assert.equal(room.ownership[1].ownerId, "p1", "reverted to the original owner");
  assert.equal(room.ownership[1].houses, 0, "the Detonate damage persists -- not reverted to the pre-seizure 2 houses");
  assert.ok(owner.properties.includes(1));
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

test("broadcast: seizing a tile bumps hostileTakeoverSeq/lastHostileTakeover for client animation, carrying the previous owner (or null for an unowned tile)", () => {
  const room = makeRoom(["Kingpin", "Owner"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "H";
  ownTile(room, "p1", 1);

  assert.equal(room.hostileTakeoverSeq, 0);
  room.useAbility("p0", { tileId: 1 });
  assert.equal(room.hostileTakeoverSeq, 1);
  assert.deepEqual(room.lastHostileTakeover, { casterId: "p0", tileId: 1, previousOwnerId: "p1" });

  const room2 = makeRoom(["Kingpin", "Other"]);
  after(() => cleanup(room2));
  room2.playerById("p0").character = "H";
  room2.useAbility("p0", { tileId: 5 }); // unowned
  assert.equal(room2.lastHostileTakeover.previousOwnerId, null);
});

test("broadcast: a rejected Hostile Takeover (invalid target, already controlled) doesn't bump hostileTakeoverSeq", () => {
  const room = makeRoom(["Kingpin", "Other"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "H";
  room.useAbility("p0", { tileId: 4 }); // a tax tile -- rejected
  assert.equal(room.hostileTakeoverSeq, 0);
});
