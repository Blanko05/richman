import { test, after } from "node:test";
import assert from "node:assert/strict";
import { makeRoom, cleanup } from "./helpers.js";

// Y -- The Wrecker. Passive: $50 from the bank whenever ANY player demolishes
// a house/hotel level or mortgages a property (no self-exclusion -- unlike
// actives, this passive doesn't target anyone). Active: Detonate fully wipes
// the target's building in one shot; cooldown scales with levels destroyed.

function ownTwoTileGroup(room, playerId, houses = 0) {
  // "olive": tiles 10 (داقستان) and 11 (موسكو) -- a real 2-tile color group,
  // granted via the existing dev helper and then leveled directly (bypassing
  // buyHouse's evenBuild/cash flow, which isn't what these tests exercise).
  room.debugGrantGroup(playerId, "olive");
  for (const tileId of [10, 11]) {
    room.ownership[tileId].houses = houses;
  }
  return [10, 11];
}

test("passive: sellHouse triggers Y's $50 bank payout, regardless of who demolished", () => {
  const room = makeRoom(["Demolisher", "Wrecker"]);
  after(() => cleanup(room));
  const demolisher = room.playerById("p0");
  const wreckerPlayer = room.playerById("p1");
  wreckerPlayer.character = "Y";
  const [tileId] = ownTwoTileGroup(room, "p0", 1);

  const demolisherBefore = demolisher.balance;
  const wreckerBefore = wreckerPlayer.balance;
  const refund = Math.floor(room._board[tileId].housePrice / 2);

  room.sellHouse("p0", tileId);

  assert.equal(demolisher.balance, demolisherBefore + refund, "seller only gets the normal refund, no extra charge");
  assert.equal(wreckerPlayer.balance, wreckerBefore + 50, "Y collects a flat $50 from the bank");
});

test("passive: the $50 bank payout is logged, not silent -- the passive was correctly firing all along but gave no visible sign it had (playtesting bug)", () => {
  const room = makeRoom(["Demolisher", "Wrecker"]);
  after(() => cleanup(room));
  const wreckerPlayer = room.playerById("p1");
  wreckerPlayer.character = "Y";
  const [tileId] = ownTwoTileGroup(room, "p0", 1);

  room.sellHouse("p0", tileId);

  assert.ok(
    room.log.some((line) => line.includes("Wrecker") && line.includes("$50") && line.includes("bank")),
    "a log line now records the passive collecting its cut"
  );
});

test("passive: mortgageProperty also triggers Y's $50 bank payout", () => {
  const room = makeRoom(["Mortgager", "Wrecker"]);
  after(() => cleanup(room));
  const mortgager = room.playerById("p0");
  const wreckerPlayer = room.playerById("p1");
  wreckerPlayer.character = "Y";
  room.debugGrantGroup("p0", "pink"); // tiles 1, 3 -- undeveloped, mortgageable as-is
  const tileId = 1;

  const mortgagerBefore = mortgager.balance;
  const wreckerBefore = wreckerPlayer.balance;
  const value = Math.floor(room._board[tileId].price / 2);

  room.mortgageProperty("p0", tileId);

  assert.equal(mortgager.balance, mortgagerBefore + value);
  assert.equal(wreckerPlayer.balance, wreckerBefore + 50);
});

test("passive: Y collects from their own demolish/mortgage too -- no self-exclusion on the passive", () => {
  const room = makeRoom(["Wrecker", "Other"]);
  after(() => cleanup(room));
  const wreckerPlayer = room.playerById("p0");
  wreckerPlayer.character = "Y";
  const [tileId] = ownTwoTileGroup(room, "p0", 1);

  const before = wreckerPlayer.balance;
  const refund = Math.floor(room._board[tileId].housePrice / 2);
  room.sellHouse("p0", tileId);

  assert.equal(wreckerPlayer.balance, before + refund + 50);
});

test("active: Detonate fully wipes a hotel to an empty lot and arms the 10-turn cooldown", () => {
  const room = makeRoom(["Wrecker", "Victim"]);
  after(() => cleanup(room));
  const wreckerPlayer = room.playerById("p0");
  wreckerPlayer.character = "Y";
  room.debugGrantGroup("p1", "olive");
  room.ownership[10].houses = 5; // hotel

  const result = room.useAbility("p0", { tileId: 10 });

  assert.deepEqual(result, { ok: true, levelsRemoved: 5 });
  assert.equal(room.ownership[10].houses, 0);
  assert.equal(wreckerPlayer.abilityCooldown, 10);
});

test("active: Detonate on an owned empty lot force-mortgages it instead, for free, and still arms the shortest (4-turn) cooldown", () => {
  const room = makeRoom(["Wrecker", "Victim"]);
  after(() => cleanup(room));
  const wreckerPlayer = room.playerById("p0");
  const victim = room.playerById("p1");
  wreckerPlayer.character = "Y";
  room.debugGrantGroup("p1", "pink"); // undeveloped
  const victimBefore = victim.balance;

  const result = room.useAbility("p0", { tileId: 1 });

  assert.deepEqual(result, { ok: true, levelsRemoved: 0, forcedMortgage: true });
  assert.equal(room.ownership[1].mortgaged, true);
  assert.equal(victim.balance, victimBefore, "no payout -- punitive, not a voluntary mortgage");
  assert.equal(wreckerPlayer.abilityCooldown, 4);
});

test("active: Detonate rejects an already-mortgaged target -- nothing left to force", () => {
  const room = makeRoom(["Wrecker", "Victim"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "Y";
  room.debugGrantGroup("p1", "pink");
  room.mortgageProperty("p1", 1);

  const result = room.useAbility("p0", { tileId: 1 });
  assert.equal(result.error, "Nothing left to destroy on this property");
  assert.equal(room.playerById("p0").abilityCooldown, 0, "a rejection arms no cooldown");
});

test("active: Detonate's forced mortgage also triggers Y's own passive, same as a real mortgage would", () => {
  const room = makeRoom(["Wrecker", "Victim"]);
  after(() => cleanup(room));
  const wreckerPlayer = room.playerById("p0");
  wreckerPlayer.character = "Y";
  room.debugGrantGroup("p1", "pink");

  const before = wreckerPlayer.balance;
  room.useAbility("p0", { tileId: 1 });

  assert.equal(wreckerPlayer.balance, before + 50);
});

test("active: Detonate also triggers Y's own passive for the building it just destroyed", () => {
  const room = makeRoom(["Wrecker", "Victim"]);
  after(() => cleanup(room));
  const wreckerPlayer = room.playerById("p0");
  wreckerPlayer.character = "Y";
  room.debugGrantGroup("p1", "olive");
  room.ownership[10].houses = 2;

  const before = wreckerPlayer.balance;
  room.useAbility("p0", { tileId: 10 });

  assert.equal(wreckerPlayer.balance, before + 50);
});

test("active: Detonate rejects targeting your own property (no self-targeting)", () => {
  const room = makeRoom(["Wrecker", "Other"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "Y";
  room.debugGrantGroup("p0", "olive");
  room.ownership[10].houses = 2;

  const result = room.useAbility("p0", { tileId: 10 });
  assert.equal(result.error, "You can't Detonate your own property");
  assert.equal(room.ownership[10].houses, 2, "target untouched after rejection");
});

test("active: Detonate rejects an unowned tile", () => {
  const room = makeRoom(["Wrecker", "Other"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "Y";
  const result = room.useAbility("p0", { tileId: 10 }); // olive, nobody owns it yet
  assert.equal(result.error, "That property isn't owned by anyone");
});

test("active: Detonate rejects a non-property tile", () => {
  const room = makeRoom(["Wrecker", "Other"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "Y";
  const result = room.useAbility("p0", { tileId: 6 }); // a transit station
  assert.equal(result.error, "Invalid target");
});

test("broadcast: demolishing bumps detonateSeq/lastDetonate for client animation, carrying levelsRemoved since owned.houses is already 0 by the time the broadcast lands", () => {
  const room = makeRoom(["Wrecker", "Victim"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "Y";
  room.debugGrantGroup("p1", "olive");
  room.ownership[10].houses = 3;
  assert.equal(room.detonateSeq, 0);
  assert.equal(room.lastDetonate, null);

  room.useAbility("p0", { tileId: 10 });

  assert.equal(room.detonateSeq, 1);
  assert.deepEqual(room.lastDetonate, { casterId: "p0", targetId: "p1", tileId: 10, levelsRemoved: 3, forcedMortgage: false });
});

test("broadcast: a forced mortgage (nothing built) also bumps detonateSeq/lastDetonate, with forcedMortgage true and levelsRemoved 0", () => {
  const room = makeRoom(["Wrecker", "Victim"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "Y";
  room.debugGrantGroup("p1", "pink");

  room.useAbility("p0", { tileId: 1 });

  assert.equal(room.detonateSeq, 1);
  assert.deepEqual(room.lastDetonate, { casterId: "p0", targetId: "p1", tileId: 1, levelsRemoved: 0, forcedMortgage: true });
});

test("broadcast: a rejected Detonate (already mortgaged, self-target, etc.) doesn't bump detonateSeq", () => {
  const room = makeRoom(["Wrecker", "Victim"]);
  after(() => cleanup(room));
  room.playerById("p0").character = "Y";
  room.debugGrantGroup("p1", "pink");
  room.mortgageProperty("p1", 1);

  room.useAbility("p0", { tileId: 1 });

  assert.equal(room.detonateSeq, 0);
  assert.equal(room.lastDetonate, null);
});

test("active: Detonate is blocked while on cooldown, and the cooldown only ticks on Y's own turn end", () => {
  const room = makeRoom(["Wrecker", "Victim"]);
  after(() => cleanup(room));
  const wreckerPlayer = room.playerById("p0");
  wreckerPlayer.character = "Y";
  room.debugGrantGroup("p1", "pink");
  room.ownership[1].houses = 0;

  room.useAbility("p0", { tileId: 1 }); // empty lot -> 4-turn cooldown
  assert.equal(wreckerPlayer.abilityCooldown, 4);

  const blocked = room.useAbility("p0", { tileId: 3 });
  assert.equal(blocked.error, "On cooldown for 4 more of your turns");

  room.endTurn(); // p0's turn ends -- cooldown ticks
  assert.equal(wreckerPlayer.abilityCooldown, 3);
  room.endTurn(); // p1's turn ends -- p0 untouched
  assert.equal(wreckerPlayer.abilityCooldown, 3);
});
