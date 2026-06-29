import { test } from "node:test";
import assert from "node:assert/strict";
import { BOARD, TOTAL_TILES } from "../src/game/board.js";
import { resolveMap, DEFAULT_MAP_ID } from "../src/game/maps/index.js";

const MAP_IDS = ["jordan", "american", "corporate", "land67"];

test("every alternate map shares the default board's tile-type skeleton", () => {
  for (const mapId of MAP_IDS) {
    const map = resolveMap(mapId);
    assert.equal(map.board.length, TOTAL_TILES, `${mapId} should have ${TOTAL_TILES} tiles`);
    for (let i = 0; i < TOTAL_TILES; i++) {
      assert.equal(map.board[i].type, BOARD[i].type, `${mapId} tile ${i} type should match the default board`);
      assert.equal(map.board[i].group, BOARD[i].group, `${mapId} tile ${i} group should match the default board`);
      assert.equal(map.board[i].price, BOARD[i].price, `${mapId} tile ${i} price should match the default board`);
    }
    assert.ok(map.surpriseCards.length > 0, `${mapId} should have surprise cards`);
    assert.ok(map.treasureCards.length > 0, `${mapId} should have treasure cards`);
  }
});

test("resolveMap falls back to the default map for an unknown or missing id", () => {
  assert.equal(resolveMap("not-a-real-map").id, DEFAULT_MAP_ID);
  assert.equal(resolveMap(undefined).id, DEFAULT_MAP_ID);
});
