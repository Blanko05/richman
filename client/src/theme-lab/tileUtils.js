// Shared geometry helpers used by every board theme component.
// Import these instead of reinventing them per-theme.

// Map a tile id (0-47) to a {row, col} position on a 13x13 CSS grid
// (1-indexed). id 0 = top-left corner, ids increase clockwise:
//   0-12  = top row, left to right
//   13-24 = right column, top to bottom
//   25-36 = bottom row, right to left
//   37-47 = left column, bottom to top
export function tileGridPos(i) {
  if (i <= 12) return { row: 1, col: 1 + i };
  if (i <= 24) return { row: 1 + (i - 12), col: 13 };
  if (i <= 36) return { row: 13, col: 13 - (i - 24) };
  return { row: 13 - (i - 36), col: 1 };
}

// Which board edge a tile sits on.
// Corners return the name of their own corner instead ("tl","tr","br","bl").
export function tileSide(i) {
  if (i === 0) return "tl";  // top-left corner
  if (i === 12) return "tr"; // top-right corner
  if (i === 24) return "br"; // bottom-right corner
  if (i === 36) return "bl"; // bottom-left corner
  if (i < 12) return "top";
  if (i < 24) return "right";
  if (i < 36) return "bottom";
  return "left";
}

export const CORNERS = new Set([0, 12, 24, 36]);
export function isCorner(i) { return CORNERS.has(i); }

// CSS grid template that matches the non-uniform corner sizing used on the
// real board (corners are 1.5× wider/taller than regular tiles).
export const BOARD_GRID_TEMPLATE =
  "minmax(0,1.5fr) repeat(11,minmax(0,1fr)) minmax(0,1.5fr)";

// Inline styles for the board root that guarantee it fits in the viewport
// regardless of window size, using the smallest of:
//   - the horizontal budget: 100vw minus the ThemeLab's 24px padding each side
//   - the vertical budget:   100vh minus the tab bar (~52px) and 24px padding each side
// Since aspect-ratio:1 is set on the element, one size drives both dimensions.
export const BOARD_SIZE_STYLE = {
  width: "min(calc(100vw - 48px), calc(100vh - 100px))",
  height: "min(calc(100vw - 48px), calc(100vh - 100px))",
  aspectRatio: "1",
};
