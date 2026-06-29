// American map — same 32-tile skeleton as the default board, themed names only.

import { TILE_TYPES, COLOR_GROUP_DEFS as G } from "../board.js";

export const BOARD = [
  { id: 0, type: TILE_TYPES.START, name: "Liberty Square" },
  { id: 1, type: TILE_TYPES.PROPERTY, name: "Route 66 Diner", group: "copper", price: 60, rent: G.copper.rentLevels, housePrice: G.copper.housePrice },
  { id: 2, type: TILE_TYPES.TREASURE, name: "Lucky Break" },
  { id: 3, type: TILE_TYPES.PROPERTY, name: "Route 66 Motel", group: "copper", price: 60, rent: G.copper.rentLevels, housePrice: G.copper.housePrice },
  { id: 4, type: TILE_TYPES.TAX, name: "IRS Audit", amount: 100 },
  { id: 5, type: TILE_TYPES.TRANSIT, name: "Greyhound Station", price: 150, rent: [25, 50, 100, 200] },
  { id: 6, type: TILE_TYPES.PROPERTY, name: "Bourbon Street", group: "teal", price: 100, rent: G.teal.rentLevels, housePrice: G.teal.housePrice },
  { id: 7, type: TILE_TYPES.SURPRISE, name: "Chance Encounter" },
  { id: 8, type: TILE_TYPES.PROPERTY, name: "French Quarter", group: "teal", price: 100, rent: G.teal.rentLevels, housePrice: G.teal.housePrice },
  { id: 9, type: TILE_TYPES.PROPERTY, name: "Jazz Club Row", group: "teal", price: 120, rent: G.teal.rentLevels, housePrice: G.teal.housePrice },
  { id: 10, type: TILE_TYPES.HOLDING, name: "County Jail" },
  { id: 11, type: TILE_TYPES.PROPERTY, name: "Hollywood Blvd", group: "violet", price: 140, rent: G.violet.rentLevels, housePrice: G.violet.housePrice },
  { id: 12, type: TILE_TYPES.UTILITY, name: "Pacific Power & Light", price: 150, multiplier: [4, 10] },
  { id: 13, type: TILE_TYPES.PROPERTY, name: "Sunset Strip", group: "violet", price: 140, rent: G.violet.rentLevels, housePrice: G.violet.housePrice },
  { id: 14, type: TILE_TYPES.PROPERTY, name: "Rodeo Drive", group: "violet", price: 160, rent: G.violet.rentLevels, housePrice: G.violet.housePrice },
  { id: 15, type: TILE_TYPES.TRANSIT, name: "Amtrak Central", price: 150, rent: [25, 50, 100, 200] },
  { id: 16, type: TILE_TYPES.PROPERTY, name: "Las Vegas Strip", group: "amber", price: 180, rent: G.amber.rentLevels, housePrice: G.amber.housePrice },
  { id: 17, type: TILE_TYPES.TREASURE, name: "Lucky Break" },
  { id: 18, type: TILE_TYPES.PROPERTY, name: "Fremont Street", group: "amber", price: 180, rent: G.amber.rentLevels, housePrice: G.amber.housePrice },
  { id: 19, type: TILE_TYPES.PROPERTY, name: "Caesars Casino", group: "amber", price: 200, rent: G.amber.rentLevels, housePrice: G.amber.housePrice },
  { id: 20, type: TILE_TYPES.REST, name: "National Park Rest Stop" },
  { id: 21, type: TILE_TYPES.PROPERTY, name: "Wall Street", group: "crimson", price: 220, rent: G.crimson.rentLevels, housePrice: G.crimson.housePrice },
  { id: 22, type: TILE_TYPES.SURPRISE, name: "Chance Encounter" },
  { id: 23, type: TILE_TYPES.PROPERTY, name: "Federal Reserve Plaza", group: "crimson", price: 220, rent: G.crimson.rentLevels, housePrice: G.crimson.housePrice },
  { id: 24, type: TILE_TYPES.PROPERTY, name: "Times Square", group: "crimson", price: 240, rent: G.crimson.rentLevels, housePrice: G.crimson.housePrice },
  { id: 25, type: TILE_TYPES.TRANSIT, name: "Grand Central Terminal", price: 150, rent: [25, 50, 100, 200] },
  { id: 26, type: TILE_TYPES.PROPERTY, name: "Capitol Hill", group: "azure", price: 260, rent: G.azure.rentLevels, housePrice: G.azure.housePrice },
  { id: 27, type: TILE_TYPES.PROPERTY, name: "Pennsylvania Avenue", group: "azure", price: 260, rent: G.azure.rentLevels, housePrice: G.azure.housePrice },
  { id: 28, type: TILE_TYPES.UTILITY, name: "Hoover Dam Power Co.", price: 150, multiplier: [4, 10] },
  { id: 29, type: TILE_TYPES.PROPERTY, name: "The White House", group: "azure", price: 280, rent: G.azure.rentLevels, housePrice: G.azure.housePrice },
  { id: 30, type: TILE_TYPES.GO_TO_HOLDING, name: "Wanted by the FBI" },
  { id: 31, type: TILE_TYPES.PROPERTY, name: "Silicon Valley HQ", group: "jade", price: 300, rent: G.jade.rentLevels, housePrice: G.jade.housePrice },
];

export const SURPRISE_CARDS = [
  { id: "s1", text: "Speeding ticket on the interstate! Pay 40 coins.", effect: { type: "pay", amount: 40 } },
  { id: "s2", text: "Storm damage! Pay 15 coins per house, 50 per hotel.", effect: { type: "repair", house: 15, hotel: 50 } },
  { id: "s3", text: "Jaywalking on Sunset Strip. Pay 50 coins.", effect: { type: "pay", amount: 50 } },
  { id: "s4", text: "Advance to Liberty Square and collect 200 coins.", effect: { type: "advanceTo", tile: 0, collectStart: true } },
  { id: "s5", text: "Caught red-handed — go directly to County Jail.", effect: { type: "goToHolding" } },
  { id: "s6", text: "Missed your exit. Move back 3 spaces.", effect: { type: "move", steps: -3 } },
  { id: "s7", text: "Bad poker night. Pay each player 25 coins.", effect: { type: "payEachPlayer", amount: 25 } },
];

export const TREASURE_CARDS = [
  { id: "t1", text: "Tax refund! Collect 20 coins.", effect: { type: "collect", amount: 20 } },
  { id: "t2", text: "You hit a slot machine jackpot! Collect 100 coins.", effect: { type: "collect", amount: 100 } },
  { id: "t3", text: "Birthday gift! Collect 10 coins from every player.", effect: { type: "collectFromEachPlayer", amount: 10 } },
  { id: "t4", text: "Sold a vintage muscle car. Collect 50 coins.", effect: { type: "collect", amount: 50 } },
  { id: "t5", text: "Advance to Liberty Square and collect 200 coins.", effect: { type: "advanceTo", tile: 0, collectStart: true } },
  { id: "t6", text: "Got bailed out — get out of County Jail free.", effect: { type: "getOutFree" } },
  { id: "t7", text: "Your tech startup stock matured! Collect 150 coins.", effect: { type: "collect", amount: 150 } },
];
