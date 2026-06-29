// "بلد الستات والسبعات" — same 32-tile skeleton as the default board, themed names only.

import { TILE_TYPES, COLOR_GROUP_DEFS as G } from "../board.js";

export const BOARD = [
  { id: 0, type: TILE_TYPES.START, name: "يوم الراتب" },
  { id: 1, type: TILE_TYPES.PROPERTY, name: "بلجيكا", group: "copper", price: 60, rent: G.copper.rentLevels, housePrice: G.copper.housePrice },
  { id: 2, type: TILE_TYPES.TREASURE, name: "مظروف تحت الطاولة" },
  { id: 3, type: TILE_TYPES.PROPERTY, name: "بلجيكا الصغيرة", group: "copper", price: 60, rent: G.copper.rentLevels, housePrice: G.copper.housePrice },
  { id: 4, type: TILE_TYPES.TAX, name: "نفقة الأولاد", amount: 100 },
  { id: 5, type: TILE_TYPES.TRANSIT, name: "مجمع باصات الجنوب", price: 150, rent: [25, 50, 100, 200] },
  { id: 6, type: TILE_TYPES.PROPERTY, name: "الغور الصافي", group: "teal", price: 100, rent: G.teal.rentLevels, housePrice: G.teal.housePrice },
  { id: 7, type: TILE_TYPES.SURPRISE, name: "خبر يلخبط" },
  { id: 8, type: TILE_TYPES.PROPERTY, name: "الصافي - السوق", group: "teal", price: 100, rent: G.teal.rentLevels, housePrice: G.teal.housePrice },
  { id: 9, type: TILE_TYPES.PROPERTY, name: "الصافي - الكورنيش", group: "teal", price: 120, rent: G.teal.rentLevels, housePrice: G.teal.housePrice },
  { id: 10, type: TILE_TYPES.HOLDING, name: "بالحبس مضاليم" },
  { id: 11, type: TILE_TYPES.PROPERTY, name: "ماركا الشمالية", group: "violet", price: 140, rent: G.violet.rentLevels, housePrice: G.violet.housePrice },
  { id: 12, type: TILE_TYPES.UTILITY, name: "محل الطعمية", price: 150, multiplier: [4, 10] },
  { id: 13, type: TILE_TYPES.PROPERTY, name: "ماركا الجنوبية", group: "violet", price: 140, rent: G.violet.rentLevels, housePrice: G.violet.housePrice },
  { id: 14, type: TILE_TYPES.PROPERTY, name: "سوق ماركا", group: "violet", price: 160, rent: G.violet.rentLevels, housePrice: G.violet.housePrice },
  { id: 15, type: TILE_TYPES.TRANSIT, name: "مجمع باصات الشمال", price: 150, rent: [25, 50, 100, 200] },
  { id: 16, type: TILE_TYPES.PROPERTY, name: "طبربور", group: "amber", price: 180, rent: G.amber.rentLevels, housePrice: G.amber.housePrice },
  { id: 17, type: TILE_TYPES.TREASURE, name: "مظروف تحت الطاولة" },
  { id: 18, type: TILE_TYPES.PROPERTY, name: "مفرق طبربور", group: "amber", price: 180, rent: G.amber.rentLevels, housePrice: G.amber.housePrice },
  { id: 19, type: TILE_TYPES.PROPERTY, name: "سوق الموبايلات - طبربور", group: "amber", price: 200, rent: G.amber.rentLevels, housePrice: G.amber.housePrice },
  { id: 20, type: TILE_TYPES.REST, name: "كرسي الحارة" },
  { id: 21, type: TILE_TYPES.PROPERTY, name: "الجاردنز", group: "crimson", price: 220, rent: G.crimson.rentLevels, housePrice: G.crimson.housePrice },
  { id: 22, type: TILE_TYPES.SURPRISE, name: "خبر يلخبط" },
  { id: 23, type: TILE_TYPES.PROPERTY, name: "شارع الجاردنز", group: "crimson", price: 220, rent: G.crimson.rentLevels, housePrice: G.crimson.housePrice },
  { id: 24, type: TILE_TYPES.PROPERTY, name: "كوفي شوب الجاردنز", group: "crimson", price: 240, rent: G.crimson.rentLevels, housePrice: G.crimson.housePrice },
  { id: 25, type: TILE_TYPES.TRANSIT, name: "مجمع باصات الشمال الغربي", price: 150, rent: [25, 50, 100, 200] },
  { id: 26, type: TILE_TYPES.PROPERTY, name: "عبدون", group: "azure", price: 260, rent: G.azure.rentLevels, housePrice: G.azure.housePrice },
  { id: 27, type: TILE_TYPES.PROPERTY, name: "دابوق", group: "azure", price: 260, rent: G.azure.rentLevels, housePrice: G.azure.housePrice },
  { id: 28, type: TILE_TYPES.UTILITY, name: "محل الحمص", price: 150, multiplier: [4, 10] },
  { id: 29, type: TILE_TYPES.PROPERTY, name: "عبدون - الدوار الأخير", group: "azure", price: 280, rent: G.azure.rentLevels, housePrice: G.azure.housePrice },
  { id: 30, type: TILE_TYPES.GO_TO_HOLDING, name: "مذكرة توقيف بحقك" },
  { id: 31, type: TILE_TYPES.PROPERTY, name: "جزيرة ابستين", group: "jade", price: 300, rent: G.jade.rentLevels, housePrice: G.jade.housePrice },
];

export const SURPRISE_CARDS = [
  { id: "s1", text: "قرش مرأة! إدفع 40 دينار.", effect: { type: "pay", amount: 40 } },
  { id: "s2", text: "نفقة الأولاد تراكمت! إدفع 15 دينار عن كل بيت و50 عن كل فندق.", effect: { type: "repair", house: 15, hotel: 50 } },
  { id: "s3", text: "خالفوك مخالفة سير! إدفع 50 دينار.", effect: { type: "pay", amount: 50 } },
  { id: "s4", text: "رجعت ليوم الراتب، إقبض 200 دينار.", effect: { type: "advanceTo", tile: 0, collectStart: true } },
  { id: "s5", text: "مذكرة توقيف بحقك! روح على الحبس على طول.", effect: { type: "goToHolding" } },
  { id: "s6", text: "الحيط سمع! ارجع 3 خطوات للخلف من الفضيحة.", effect: { type: "move", steps: -3 } },
  { id: "s7", text: "زفة العيلة! إدفع لكل لاعب 25 دينار.", effect: { type: "payEachPlayer", amount: 25 } },
];

export const TREASURE_CARDS = [
  { id: "t1", text: "وصلك مصاري الضمان! إقبض 20 دينار.", effect: { type: "collect", amount: 20 } },
  { id: "t2", text: "زلمتك سدلك دين! إقبض 100 دينار.", effect: { type: "collect", amount: 100 } },
  { id: "t3", text: "عيد ميلادك! اقبض 10 دينار من كل لاعب.", effect: { type: "collectFromEachPlayer", amount: 10 } },
  { id: "t4", text: "بعت الذهب القديم! اقبض 50 دينار.", effect: { type: "collect", amount: 50 } },
  { id: "t5", text: "رجعت ليوم الراتب، اقبض 200 دينار.", effect: { type: "advanceTo", tile: 0, collectStart: true } },
  { id: "t6", text: "الله يفك اسرك! وصلت الواسطة — بطاقة خروج من الحبس مجانية.", effect: { type: "getOutFree" } },
  { id: "t7", text: "بس توصل رنلي! كنت فاكر طالعتك بالواسطة... بس لا، روح ع الحبس.", effect: { type: "goToHolding" } },
];
