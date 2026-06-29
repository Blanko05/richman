// Jordan map — same 32-tile skeleton as the default board, themed names only.

import { TILE_TYPES, COLOR_GROUP_DEFS as G } from "../board.js";

export const BOARD = [
  { id: 0, type: TILE_TYPES.START, name: "Amman Square" },
  { id: 1, type: TILE_TYPES.PROPERTY, name: "Karak Castle", group: "copper", price: 60, rent: G.copper.rentLevels, housePrice: G.copper.housePrice },
  { id: 2, type: TILE_TYPES.TREASURE, name: "Bedouin Treasure" },
  { id: 3, type: TILE_TYPES.PROPERTY, name: "Ajloun Fort", group: "copper", price: 60, rent: G.copper.rentLevels, housePrice: G.copper.housePrice },
  { id: 4, type: TILE_TYPES.TAX, name: "Desert Toll", amount: 100 },
  { id: 5, type: TILE_TYPES.TRANSIT, name: "Aqaba Port", price: 150, rent: [25, 50, 100, 200] },
  { id: 6, type: TILE_TYPES.PROPERTY, name: "Dead Sea Shore", group: "teal", price: 100, rent: G.teal.rentLevels, housePrice: G.teal.housePrice },
  { id: 7, type: TILE_TYPES.SURPRISE, name: "Bedouin Surprise" },
  { id: 8, type: TILE_TYPES.PROPERTY, name: "Wadi Mujib", group: "teal", price: 100, rent: G.teal.rentLevels, housePrice: G.teal.housePrice },
  { id: 9, type: TILE_TYPES.PROPERTY, name: "Dead Sea Resort", group: "teal", price: 120, rent: G.teal.rentLevels, housePrice: G.teal.housePrice },
  { id: 10, type: TILE_TYPES.HOLDING, name: "Desert Checkpoint" },
  { id: 11, type: TILE_TYPES.PROPERTY, name: "Jerash Ruins", group: "violet", price: 140, rent: G.violet.rentLevels, housePrice: G.violet.housePrice },
  { id: 12, type: TILE_TYPES.UTILITY, name: "Disi Water Co.", price: 150, multiplier: [4, 10] },
  { id: 13, type: TILE_TYPES.PROPERTY, name: "Umm Qais", group: "violet", price: 140, rent: G.violet.rentLevels, housePrice: G.violet.housePrice },
  { id: 14, type: TILE_TYPES.PROPERTY, name: "Ajloun Forest Reserve", group: "violet", price: 160, rent: G.violet.rentLevels, housePrice: G.violet.housePrice },
  { id: 15, type: TILE_TYPES.TRANSIT, name: "Amman Bus Terminal", price: 150, rent: [25, 50, 100, 200] },
  { id: 16, type: TILE_TYPES.PROPERTY, name: "Wadi Rum Desert", group: "amber", price: 180, rent: G.amber.rentLevels, housePrice: G.amber.housePrice },
  { id: 17, type: TILE_TYPES.TREASURE, name: "Bedouin Treasure" },
  { id: 18, type: TILE_TYPES.PROPERTY, name: "Rum Village", group: "amber", price: 180, rent: G.amber.rentLevels, housePrice: G.amber.housePrice },
  { id: 19, type: TILE_TYPES.PROPERTY, name: "Disi Sands", group: "amber", price: 200, rent: G.amber.rentLevels, housePrice: G.amber.housePrice },
  { id: 20, type: TILE_TYPES.REST, name: "Dana Biosphere Rest" },
  { id: 21, type: TILE_TYPES.PROPERTY, name: "Petra Treasury", group: "crimson", price: 220, rent: G.crimson.rentLevels, housePrice: G.crimson.housePrice },
  { id: 22, type: TILE_TYPES.SURPRISE, name: "Bedouin Surprise" },
  { id: 23, type: TILE_TYPES.PROPERTY, name: "Petra Siq", group: "crimson", price: 220, rent: G.crimson.rentLevels, housePrice: G.crimson.housePrice },
  { id: 24, type: TILE_TYPES.PROPERTY, name: "Monastery (Ad Deir)", group: "crimson", price: 240, rent: G.crimson.rentLevels, housePrice: G.crimson.housePrice },
  { id: 25, type: TILE_TYPES.TRANSIT, name: "Irbid Train Hub", price: 150, rent: [25, 50, 100, 200] },
  { id: 26, type: TILE_TYPES.PROPERTY, name: "King's Highway", group: "azure", price: 260, rent: G.azure.rentLevels, housePrice: G.azure.housePrice },
  { id: 27, type: TILE_TYPES.PROPERTY, name: "Madaba Mosaics", group: "azure", price: 260, rent: G.azure.rentLevels, housePrice: G.azure.housePrice },
  { id: 28, type: TILE_TYPES.UTILITY, name: "Jordan Valley Irrigation Co.", price: 150, multiplier: [4, 10] },
  { id: 29, type: TILE_TYPES.PROPERTY, name: "Mount Nebo", group: "azure", price: 280, rent: G.azure.rentLevels, housePrice: G.azure.housePrice },
  { id: 30, type: TILE_TYPES.GO_TO_HOLDING, name: "Border Patrol" },
  { id: 31, type: TILE_TYPES.PROPERTY, name: "Amman Citadel", group: "jade", price: 300, rent: G.jade.rentLevels, housePrice: G.jade.housePrice },
];

export const SURPRISE_CARDS = [
  { id: "s1", text: "Speeding ticket on the King's Highway! Pay 40 coins.", effect: { type: "pay", amount: 40 } },
  { id: "s2", text: "Sandstorm damage! Pay 15 coins per house, 50 per hotel.", effect: { type: "repair", house: 15, hotel: 50 } },
  { id: "s3", text: "Overstayed your desert camp permit. Pay 50 coins.", effect: { type: "pay", amount: 50 } },
  { id: "s4", text: "Advance to Amman Square and collect 200 coins.", effect: { type: "advanceTo", tile: 0, collectStart: true } },
  { id: "s5", text: "Stopped without papers — go directly to the Desert Checkpoint.", effect: { type: "goToHolding" } },
  { id: "s6", text: "Lost your caravan's way. Move back 3 spaces.", effect: { type: "move", steps: -3 } },
  { id: "s7", text: "Tip your tour guide. Pay each player 25 coins.", effect: { type: "payEachPlayer", amount: 25 } },
];

export const TREASURE_CARDS = [
  { id: "t1", text: "Tax refund from the Ministry of Tourism! Collect 20 coins.", effect: { type: "collect", amount: 20 } },
  { id: "t2", text: "Found an old coin in Petra! Collect 100 coins.", effect: { type: "collect", amount: 100 } },
  { id: "t3", text: "Eid gift! Collect 10 coins from every player.", effect: { type: "collectFromEachPlayer", amount: 10 } },
  { id: "t4", text: "Sold a hand-woven rug. Collect 50 coins.", effect: { type: "collect", amount: 50 } },
  { id: "t5", text: "Advance to Amman Square and collect 200 coins.", effect: { type: "advanceTo", tile: 0, collectStart: true } },
  { id: "t6", text: "Your guide vouches for you — get out of the Desert Checkpoint free.", effect: { type: "getOutFree" } },
  { id: "t7", text: "Your falafel stand investment matured! Collect 150 coins.", effect: { type: "collect", amount: 150 } },
];
