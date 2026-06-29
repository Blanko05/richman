// Corporate Ladder map — office-satire theme, same 32-tile skeleton as the default board.

import { TILE_TYPES, COLOR_GROUP_DEFS as G } from "../board.js";

export const BOARD = [
  { id: 0, type: TILE_TYPES.START, name: "Reception Desk" },
  { id: 1, type: TILE_TYPES.PROPERTY, name: "Mailroom", group: "copper", price: 60, rent: G.copper.rentLevels, housePrice: G.copper.housePrice },
  { id: 2, type: TILE_TYPES.TREASURE, name: "Annual Bonus" },
  { id: 3, type: TILE_TYPES.PROPERTY, name: "Supply Closet", group: "copper", price: 60, rent: G.copper.rentLevels, housePrice: G.copper.housePrice },
  { id: 4, type: TILE_TYPES.TAX, name: "Printer Toner Fee", amount: 100 },
  { id: 5, type: TILE_TYPES.TRANSIT, name: "Elevator Bank A", price: 150, rent: [25, 50, 100, 200] },
  { id: 6, type: TILE_TYPES.PROPERTY, name: "Marketing Pit", group: "teal", price: 100, rent: G.teal.rentLevels, housePrice: G.teal.housePrice },
  { id: 7, type: TILE_TYPES.SURPRISE, name: "Reply-All Email" },
  { id: 8, type: TILE_TYPES.PROPERTY, name: "Open-Plan Marketing Desk", group: "teal", price: 100, rent: G.teal.rentLevels, housePrice: G.teal.housePrice },
  { id: 9, type: TILE_TYPES.PROPERTY, name: "Marketing War Room", group: "teal", price: 120, rent: G.teal.rentLevels, housePrice: G.teal.housePrice },
  { id: 10, type: TILE_TYPES.HOLDING, name: "Mandatory Team-Building Retreat" },
  { id: 11, type: TILE_TYPES.PROPERTY, name: "Sales Floor", group: "violet", price: 140, rent: G.violet.rentLevels, housePrice: G.violet.housePrice },
  { id: 12, type: TILE_TYPES.UTILITY, name: "WiFi & Coffee Machine", price: 150, multiplier: [4, 10] },
  { id: 13, type: TILE_TYPES.PROPERTY, name: "Sales Cold-Call Pod", group: "violet", price: 140, rent: G.violet.rentLevels, housePrice: G.violet.housePrice },
  { id: 14, type: TILE_TYPES.PROPERTY, name: "VP of Sales Office", group: "violet", price: 160, rent: G.violet.rentLevels, housePrice: G.violet.housePrice },
  { id: 15, type: TILE_TYPES.TRANSIT, name: "Elevator Bank B", price: 150, rent: [25, 50, 100, 200] },
  { id: 16, type: TILE_TYPES.PROPERTY, name: "Engineering Bullpen", group: "amber", price: 180, rent: G.amber.rentLevels, housePrice: G.amber.housePrice },
  { id: 17, type: TILE_TYPES.TREASURE, name: "Annual Bonus" },
  { id: 18, type: TILE_TYPES.PROPERTY, name: "Engineering Standing Desk Row", group: "amber", price: 180, rent: G.amber.rentLevels, housePrice: G.amber.housePrice },
  { id: 19, type: TILE_TYPES.PROPERTY, name: "Engineering On-Call Room", group: "amber", price: 200, rent: G.amber.rentLevels, housePrice: G.amber.housePrice },
  { id: 20, type: TILE_TYPES.REST, name: "Lunch Break" },
  { id: 21, type: TILE_TYPES.PROPERTY, name: "Finance Department", group: "crimson", price: 220, rent: G.crimson.rentLevels, housePrice: G.crimson.housePrice },
  { id: 22, type: TILE_TYPES.SURPRISE, name: "Reply-All Email" },
  { id: 23, type: TILE_TYPES.PROPERTY, name: "Budget Review Room", group: "crimson", price: 220, rent: G.crimson.rentLevels, housePrice: G.crimson.housePrice },
  { id: 24, type: TILE_TYPES.PROPERTY, name: "CFO's Office", group: "crimson", price: 240, rent: G.crimson.rentLevels, housePrice: G.crimson.housePrice },
  { id: 25, type: TILE_TYPES.TRANSIT, name: "Elevator Bank C", price: 150, rent: [25, 50, 100, 200] },
  { id: 26, type: TILE_TYPES.PROPERTY, name: "Legal Department", group: "azure", price: 260, rent: G.azure.rentLevels, housePrice: G.azure.housePrice },
  { id: 27, type: TILE_TYPES.PROPERTY, name: "Compliance Wing", group: "azure", price: 260, rent: G.azure.rentLevels, housePrice: G.azure.housePrice },
  { id: 28, type: TILE_TYPES.UTILITY, name: "HR Hotline", price: 150, multiplier: [4, 10] },
  { id: 29, type: TILE_TYPES.PROPERTY, name: "General Counsel's Office", group: "azure", price: 280, rent: G.azure.rentLevels, housePrice: G.azure.housePrice },
  { id: 30, type: TILE_TYPES.GO_TO_HOLDING, name: "CC'd by HR" },
  { id: 31, type: TILE_TYPES.PROPERTY, name: "Executive Suite", group: "jade", price: 300, rent: G.jade.rentLevels, housePrice: G.jade.housePrice },
];

export const SURPRISE_CARDS = [
  { id: "s1", text: "Parked in the visitor spot! Pay 40 coins.", effect: { type: "pay", amount: 40 } },
  { id: "s2", text: "IT charged you for hardware damage. Pay 15 coins per house, 50 per hotel.", effect: { type: "repair", house: 15, hotel: 50 } },
  { id: "s3", text: "Caught browsing social media during a meeting. Pay 50 coins.", effect: { type: "pay", amount: 50 } },
  { id: "s4", text: "Advance to the Reception Desk and collect 200 coins.", effect: { type: "advanceTo", tile: 0, collectStart: true } },
  { id: "s5", text: "Your manager saw your calendar — go directly to the Mandatory Team-Building Retreat.", effect: { type: "goToHolding" } },
  { id: "s6", text: "Got lost looking for a free conference room. Move back 3 spaces.", effect: { type: "move", steps: -3 } },
  { id: "s7", text: "You forgot everyone's birthday card. Pay each player 25 coins.", effect: { type: "payEachPlayer", amount: 25 } },
];

export const TREASURE_CARDS = [
  { id: "t1", text: "Expense report approved! Collect 20 coins.", effect: { type: "collect", amount: 20 } },
  { id: "t2", text: "Won the office raffle! Collect 100 coins.", effect: { type: "collect", amount: 100 } },
  { id: "t3", text: "Office potluck day! Collect 10 coins from every player.", effect: { type: "collectFromEachPlayer", amount: 10 } },
  { id: "t4", text: "Sold your stapler collection online. Collect 50 coins.", effect: { type: "collect", amount: 50 } },
  { id: "t5", text: "Advance to the Reception Desk and collect 200 coins.", effect: { type: "advanceTo", tile: 0, collectStart: true } },
  { id: "t6", text: "HR closed your case with no action — get out of the Retreat free.", effect: { type: "getOutFree" } },
  { id: "t7", text: "Your 401k matured! Collect 150 coins.", effect: { type: "collect", amount: 150 } },
];
