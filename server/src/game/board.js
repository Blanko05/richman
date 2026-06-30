// Monoboly عرب - an original board game inspired by classic property-trading games.
// 48 tiles laid out in a square loop (12 per side). Index 0 is "Start" (top-left corner).

export const TILE_TYPES = {
  START: "start",
  PROPERTY: "property",
  TRANSIT: "transit",
  UTILITY: "utility",
  SURPRISE: "surprise",
  TREASURE: "treasure",
  TAX: "tax",
  REST: "rest", // free-parking style safe tile (also used for the mid-edge "safety" tiles)
  HOLDING: "holding", // jail-style tile
  GO_TO_HOLDING: "go_to_holding",
};

const COLOR_GROUPS = {
  pink: { color: "#ff5fa2", rentLevels: [2, 10, 30, 90, 160, 250], housePrice: 50 },
  blueTop: { color: "#2980b9", rentLevels: [6, 30, 90, 270, 400, 550], housePrice: 50 },
  olive: { color: "#6b6b1f", rentLevels: [10, 50, 150, 450, 625, 750], housePrice: 100 },
  salmonRight: { color: "#e57373", rentLevels: [14, 70, 200, 550, 750, 950], housePrice: 100 },
  goldenrod: { color: "#b8860b", rentLevels: [18, 90, 250, 700, 875, 1050], housePrice: 150 },
  greenBottom: { color: "#2ecc71", rentLevels: [22, 110, 330, 800, 975, 1150], housePrice: 150 },
  violetBottom: { color: "#9b59b6", rentLevels: [26, 130, 390, 900, 1100, 1275], housePrice: 200 },
  salmonLeft: { color: "#ef9a9a", rentLevels: [28, 150, 450, 1000, 1200, 1400], housePrice: 200 },
  tealLeft: { color: "#16a596", rentLevels: [35, 175, 500, 1100, 1400, 1700], housePrice: 250 },
};

const STATION_RENT = [25, 50, 75, 100, 150, 200]; // by count of the 6 stations owned

// Layout convention: the 4 corners (ids 0, 12, 24, 36 -- see Board.jsx's
// getGridPos) hold the 4 non-property "big" tiles (Start, Holding,
// Rest/free-parking, Go-to-Holding). Ids increase clockwise from Start
// (top-left): rightward across the top, down the right side, leftward
// across the bottom, up the left side back to Start. Within each side,
// every color group's tiles are kept contiguous; non-property tiles
// (treasure/surprise/tax/transit/the mid-edge "safety" rest tiles) sit only
// *between* groups, acting as separators, never inside one.
export const BOARD = [
  { id: 0, type: TILE_TYPES.START, name: "البداية" },
  { id: 1, type: TILE_TYPES.PROPERTY, name: "سحاب", group: "pink", price: 60, rent: COLOR_GROUPS.pink.rentLevels, housePrice: COLOR_GROUPS.pink.housePrice },
  { id: 2, type: TILE_TYPES.TREASURE, name: "صنوق الحج" },
  { id: 3, type: TILE_TYPES.PROPERTY, name: "رصيفة", group: "pink", price: 60, rent: COLOR_GROUPS.pink.rentLevels, housePrice: COLOR_GROUPS.pink.housePrice },
  { id: 4, type: TILE_TYPES.TAX, name: "ضريبة", amount: 100 },
  { id: 5, type: TILE_TYPES.PROPERTY, name: "مدينة الكويت", group: "blueTop", price: 100, rent: COLOR_GROUPS.blueTop.rentLevels, housePrice: COLOR_GROUPS.blueTop.housePrice },
  { id: 6, type: TILE_TYPES.TRANSIT, name: "محطة الكوستر", price: 150, rent: STATION_RENT },
  { id: 7, type: TILE_TYPES.PROPERTY, name: "الأحمدي", group: "blueTop", price: 100, rent: COLOR_GROUPS.blueTop.rentLevels, housePrice: COLOR_GROUPS.blueTop.housePrice },
  { id: 8, type: TILE_TYPES.PROPERTY, name: "الجزر الكويتية", group: "blueTop", price: 120, rent: COLOR_GROUPS.blueTop.rentLevels, housePrice: COLOR_GROUPS.blueTop.housePrice },
  { id: 9, type: TILE_TYPES.TRANSIT, name: "محطة كوستر", price: 150, rent: STATION_RENT },
  { id: 10, type: TILE_TYPES.PROPERTY, name: "داقستان", group: "olive", price: 140, rent: COLOR_GROUPS.olive.rentLevels, housePrice: COLOR_GROUPS.olive.housePrice },
  { id: 11, type: TILE_TYPES.PROPERTY, name: "موسكو", group: "olive", price: 160, rent: COLOR_GROUPS.olive.rentLevels, housePrice: COLOR_GROUPS.olive.housePrice },
  { id: 12, type: TILE_TYPES.HOLDING, name: "في الحبس مظاليم" },
  { id: 13, type: TILE_TYPES.PROPERTY, name: "اغوار الشمال", group: "salmonRight", price: 180, rent: COLOR_GROUPS.salmonRight.rentLevels, housePrice: COLOR_GROUPS.salmonRight.housePrice },
  { id: 14, type: TILE_TYPES.PROPERTY, name: "نهر الميراندا", group: "salmonRight", price: 180, rent: COLOR_GROUPS.salmonRight.rentLevels, housePrice: COLOR_GROUPS.salmonRight.housePrice },
  { id: 15, type: TILE_TYPES.SURPRISE, name: "الحظ" },
  { id: 16, type: TILE_TYPES.PROPERTY, name: "اغوار الجنوب", group: "salmonRight", price: 200, rent: COLOR_GROUPS.salmonRight.rentLevels, housePrice: COLOR_GROUPS.salmonRight.housePrice },
  { id: 17, type: TILE_TYPES.REST, name: "عليكم الأمان" },
  { id: 18, type: TILE_TYPES.TRANSIT, name: "محطة كوستر", price: 150, rent: STATION_RENT },
  { id: 19, type: TILE_TYPES.PROPERTY, name: "ميونخ", group: "goldenrod", price: 220, rent: COLOR_GROUPS.goldenrod.rentLevels, housePrice: COLOR_GROUPS.goldenrod.housePrice },
  { id: 20, type: TILE_TYPES.TREASURE, name: "صندوق المرأة" },
  { id: 21, type: TILE_TYPES.PROPERTY, name: "فرانكفورت", group: "goldenrod", price: 220, rent: COLOR_GROUPS.goldenrod.rentLevels, housePrice: COLOR_GROUPS.goldenrod.housePrice },
  { id: 22, type: TILE_TYPES.TAX, name: "ضريبة", amount: 150 },
  { id: 23, type: TILE_TYPES.PROPERTY, name: "بيرلين", group: "goldenrod", price: 240, rent: COLOR_GROUPS.goldenrod.rentLevels, housePrice: COLOR_GROUPS.goldenrod.housePrice },
  { id: 24, type: TILE_TYPES.REST, name: "استراحة محارب" },
  { id: 25, type: TILE_TYPES.PROPERTY, name: "نيتانيا", group: "greenBottom", price: 260, rent: COLOR_GROUPS.greenBottom.rentLevels, housePrice: COLOR_GROUPS.greenBottom.housePrice },
  { id: 26, type: TILE_TYPES.SURPRISE, name: "الحظ" },
  { id: 27, type: TILE_TYPES.PROPERTY, name: "حيفا", group: "greenBottom", price: 260, rent: COLOR_GROUPS.greenBottom.rentLevels, housePrice: COLOR_GROUPS.greenBottom.housePrice },
  { id: 28, type: TILE_TYPES.TREASURE, name: "جمعية الديوان" },
  { id: 29, type: TILE_TYPES.PROPERTY, name: "تل ابيب", group: "greenBottom", price: 280, rent: COLOR_GROUPS.greenBottom.rentLevels, housePrice: COLOR_GROUPS.greenBottom.housePrice },
  { id: 30, type: TILE_TYPES.TRANSIT, name: "محطة كوستر", price: 150, rent: STATION_RENT },
  { id: 31, type: TILE_TYPES.PROPERTY, name: "سيناء", group: "violetBottom", price: 300, rent: COLOR_GROUPS.violetBottom.rentLevels, housePrice: COLOR_GROUPS.violetBottom.housePrice },
  { id: 32, type: TILE_TYPES.PROPERTY, name: "قاهرة", group: "violetBottom", price: 300, rent: COLOR_GROUPS.violetBottom.rentLevels, housePrice: COLOR_GROUPS.violetBottom.housePrice },
  { id: 33, type: TILE_TYPES.TAX, name: "ضريبة", amount: 200 },
  { id: 34, type: TILE_TYPES.PROPERTY, name: "الاسكندرية", group: "violetBottom", price: 320, rent: COLOR_GROUPS.violetBottom.rentLevels, housePrice: COLOR_GROUPS.violetBottom.housePrice },
  { id: 35, type: TILE_TYPES.TRANSIT, name: "محطة كوستر", price: 150, rent: STATION_RENT },
  { id: 36, type: TILE_TYPES.GO_TO_HOLDING, name: "ميل عأحبابك بالمهجع" },
  { id: 37, type: TILE_TYPES.PROPERTY, name: "بابل", group: "salmonLeft", price: 340, rent: COLOR_GROUPS.salmonLeft.rentLevels, housePrice: COLOR_GROUPS.salmonLeft.housePrice },
  { id: 38, type: TILE_TYPES.PROPERTY, name: "اربيل", group: "salmonLeft", price: 340, rent: COLOR_GROUPS.salmonLeft.rentLevels, housePrice: COLOR_GROUPS.salmonLeft.housePrice },
  { id: 39, type: TILE_TYPES.PROPERTY, name: "كربلاء", group: "salmonLeft", price: 360, rent: COLOR_GROUPS.salmonLeft.rentLevels, housePrice: COLOR_GROUPS.salmonLeft.housePrice },
  { id: 40, type: TILE_TYPES.SURPRISE, name: "الحظ" },
  { id: 41, type: TILE_TYPES.PROPERTY, name: "بغداد", group: "salmonLeft", price: 360, rent: COLOR_GROUPS.salmonLeft.rentLevels, housePrice: COLOR_GROUPS.salmonLeft.housePrice },
  { id: 42, type: TILE_TYPES.TRANSIT, name: "محطة كوستر", price: 150, rent: STATION_RENT },
  { id: 43, type: TILE_TYPES.TREASURE, name: "جمعية دار المسنين" },
  { id: 44, type: TILE_TYPES.PROPERTY, name: "الطفيلة", group: "tealLeft", price: 380, rent: COLOR_GROUPS.tealLeft.rentLevels, housePrice: COLOR_GROUPS.tealLeft.housePrice },
  { id: 45, type: TILE_TYPES.PROPERTY, name: "السلط", group: "tealLeft", price: 400, rent: COLOR_GROUPS.tealLeft.rentLevels, housePrice: COLOR_GROUPS.tealLeft.housePrice },
  { id: 46, type: TILE_TYPES.REST, name: "عليكم الأمان" },
  { id: 47, type: TILE_TYPES.PROPERTY, name: "اربد", group: "tealLeft", price: 420, rent: COLOR_GROUPS.tealLeft.rentLevels, housePrice: COLOR_GROUPS.tealLeft.housePrice },
];

export const TOTAL_TILES = BOARD.length;
export const COLOR_GROUP_DEFS = COLOR_GROUPS;

export function propertiesByGroup(group) {
  return BOARD.filter((t) => t.type === TILE_TYPES.PROPERTY && t.group === group);
}
