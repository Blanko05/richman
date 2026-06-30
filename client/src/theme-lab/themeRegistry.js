import ClassicVintageBoard from "./themes/classicVintage/ClassicVintageBoard";
import NeonCyberpunkBoard from "./themes/neonCyberpunk/NeonCyberpunkBoard";
import MinimalFlatBoard from "./themes/minimalFlat/MinimalFlatBoard";
import HandDrawnBoard from "./themes/handDrawn/HandDrawnBoard";
import ArtDecoCasinoBoard from "./themes/artDecoCasino/ArtDecoCasinoBoard";

// Every theme component shares one contract: props { board, ownership,
// players, pendingAction, lastRoll, rollSeq } -- identical to the real
// client/src/components/Board.jsx -- so whichever one gets picked can be
// dropped into the real app with no data-shape changes, only a swap of
// which component renders.
export const THEMES = [
  { id: "classicVintage", label: "Classic Vintage", Component: ClassicVintageBoard },
  { id: "neonCyberpunk", label: "Neon Cyberpunk", Component: NeonCyberpunkBoard },
  { id: "minimalFlat", label: "Minimalist Flat", Component: MinimalFlatBoard },
  { id: "handDrawn", label: "Hand-drawn Storybook", Component: HandDrawnBoard },
  { id: "artDecoCasino", label: "Art Deco Casino", Component: ArtDecoCasinoBoard },
];
