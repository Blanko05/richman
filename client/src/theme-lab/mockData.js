// Static stand-in for the real BOARD shape (server/src/game/board.js), copied
// in rather than imported -- this lab is a pure front-end visual sandbox, not
// wired to a live game, so it doesn't need a real server connection. Keep the
// tile id/type/group/price shape identical to the real thing so a theme built
// here can be dropped into the real Board.jsx later with no data-shape changes.
export const TILE_TYPES = {
  START: "start",
  PROPERTY: "property",
  TRANSIT: "transit",
  SURPRISE: "surprise",
  TREASURE: "treasure",
  TAX: "tax",
  REST: "rest",
  HOLDING: "holding",
  GO_TO_HOLDING: "go_to_holding",
};

const rent = (a, b, c, d, e, f) => [a, b, c, d, e, f];

export const mockBoard = [
  { id: 0, type: "start", name: "البداية" },
  { id: 1, type: "property", name: "سحاب", group: "pink", price: 60, rent: rent(2, 10, 30, 90, 160, 250) },
  { id: 2, type: "treasure", name: "صنوق الحج" },
  { id: 3, type: "property", name: "رصيفة", group: "pink", price: 60, rent: rent(2, 10, 30, 90, 160, 250) },
  { id: 4, type: "tax", name: "ضريبة", amount: 100 },
  { id: 5, type: "property", name: "مدينة الكويت", group: "blueTop", price: 100, rent: rent(6, 30, 90, 270, 400, 550) },
  { id: 6, type: "transit", name: "محطة الكوستر", price: 150 },
  { id: 7, type: "property", name: "الأحمدي", group: "blueTop", price: 100, rent: rent(6, 30, 90, 270, 400, 550) },
  { id: 8, type: "property", name: "الجزر الكويتية", group: "blueTop", price: 120, rent: rent(6, 30, 90, 270, 400, 550) },
  { id: 9, type: "transit", name: "محطة كوستر", price: 150 },
  { id: 10, type: "property", name: "داقستان", group: "olive", price: 140, rent: rent(10, 50, 150, 450, 625, 750) },
  { id: 11, type: "property", name: "موسكو", group: "olive", price: 160, rent: rent(10, 50, 150, 450, 625, 750) },
  { id: 12, type: "holding", name: "في الحبس مظاليم" },
  { id: 13, type: "property", name: "اغوار الشمال", group: "salmonRight", price: 180, rent: rent(14, 70, 200, 550, 750, 950) },
  { id: 14, type: "property", name: "نهر الميراندا", group: "salmonRight", price: 180, rent: rent(14, 70, 200, 550, 750, 950) },
  { id: 15, type: "surprise", name: "الحظ" },
  { id: 16, type: "property", name: "اغوار الجنوب", group: "salmonRight", price: 200, rent: rent(14, 70, 200, 550, 750, 950) },
  { id: 17, type: "rest", name: "عليكم الأمان" },
  { id: 18, type: "transit", name: "محطة كوستر", price: 150 },
  { id: 19, type: "property", name: "ميونخ", group: "goldenrod", price: 220, rent: rent(18, 90, 250, 700, 875, 1050) },
  { id: 20, type: "treasure", name: "صندوق المرأة" },
  { id: 21, type: "property", name: "فرانكفورت", group: "goldenrod", price: 220, rent: rent(18, 90, 250, 700, 875, 1050) },
  { id: 22, type: "tax", name: "ضريبة", amount: 150 },
  { id: 23, type: "property", name: "بيرلين", group: "goldenrod", price: 240, rent: rent(18, 90, 250, 700, 875, 1050) },
  { id: 24, type: "rest", name: "استراحة محارب" },
  { id: 25, type: "property", name: "نيتانيا", group: "greenBottom", price: 260, rent: rent(22, 110, 330, 800, 975, 1150) },
  { id: 26, type: "surprise", name: "الحظ" },
  { id: 27, type: "property", name: "حيفا", group: "greenBottom", price: 260, rent: rent(22, 110, 330, 800, 975, 1150) },
  { id: 28, type: "treasure", name: "جمعية الديوان" },
  { id: 29, type: "property", name: "تل ابيب", group: "greenBottom", price: 280, rent: rent(22, 110, 330, 800, 975, 1150) },
  { id: 30, type: "transit", name: "محطة كوستر", price: 150 },
  { id: 31, type: "property", name: "سيناء", group: "violetBottom", price: 300, rent: rent(26, 130, 390, 900, 1100, 1275) },
  { id: 32, type: "property", name: "قاهرة", group: "violetBottom", price: 300, rent: rent(26, 130, 390, 900, 1100, 1275) },
  { id: 33, type: "tax", name: "ضريبة", amount: 200 },
  { id: 34, type: "property", name: "الاسكندرية", group: "violetBottom", price: 320, rent: rent(26, 130, 390, 900, 1100, 1275) },
  { id: 35, type: "transit", name: "محطة كوستر", price: 150 },
  { id: 36, type: "go_to_holding", name: "ميل عأحبابك بالمهجع" },
  { id: 37, type: "property", name: "بابل", group: "salmonLeft", price: 340, rent: rent(28, 150, 450, 1000, 1200, 1400) },
  { id: 38, type: "property", name: "اربيل", group: "salmonLeft", price: 340, rent: rent(28, 150, 450, 1000, 1200, 1400) },
  { id: 39, type: "property", name: "كربلاء", group: "salmonLeft", price: 360, rent: rent(28, 150, 450, 1000, 1200, 1400) },
  { id: 40, type: "surprise", name: "الحظ" },
  { id: 41, type: "property", name: "بغداد", group: "salmonLeft", price: 360, rent: rent(28, 150, 450, 1000, 1200, 1400) },
  { id: 42, type: "transit", name: "محطة كوستر", price: 150 },
  { id: 43, type: "treasure", name: "جمعية دار المسنين" },
  { id: 44, type: "property", name: "الطفيلة", group: "tealLeft", price: 380, rent: rent(35, 175, 500, 1100, 1400, 1700) },
  { id: 45, type: "property", name: "السلط", group: "tealLeft", price: 400, rent: rent(35, 175, 500, 1100, 1400, 1700) },
  { id: 46, type: "rest", name: "عليكم الأمان" },
  { id: 47, type: "property", name: "اربد", group: "tealLeft", price: 420, rent: rent(35, 175, 500, 1100, 1400, 1700) },
];

export const mockPlayers = [
  { id: "p0", name: "الدون", color: "#e74c3c", balance: 1340, position: 7, characterId: "don", bankrupt: false },
  { id: "p1", name: "المنفّذ", color: "#3498db", balance: 860, position: 21, characterId: "enforcer", bankrupt: false },
  { id: "p2", name: "الهدّام", color: "#2ecc71", balance: 2210, position: 32, characterId: "wrecker", bankrupt: false },
  { id: "p3", name: "الكمساري", color: "#f1c40f", balance: 540, position: 41, characterId: "conductor", bankrupt: false },
];

// Sparse tileId -> ownership, exercising every visual state a theme needs to
// be able to show: plain ownership, partial houses, a hotel (level 5), and a
// mortgaged property.
export const mockOwnership = {
  1: { ownerId: "p0", houses: 0 },
  3: { ownerId: "p0", houses: 2 },
  5: { ownerId: "p1", houses: 0, mortgaged: true },
  7: { ownerId: "p1", houses: 0 },
  8: { ownerId: "p1", houses: 0 },
  13: { ownerId: "p2", houses: 5 },
  19: { ownerId: "p2", houses: 1 },
  21: { ownerId: "p2", houses: 1 },
  31: { ownerId: "p3", houses: 0 },
  37: { ownerId: "p0", houses: 3 },
  44: { ownerId: "p3", houses: 0, mortgaged: true },
};

export const mockPendingAction = null;
export const mockLastRoll = [4, 2];
export const mockRollSeq = 3;
