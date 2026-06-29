function getGridPos(i) {
  if (i <= 8)  return { row: 9, col: 9 - i };
  if (i <= 16) return { row: 9 - (i - 8), col: 1 };
  if (i <= 24) return { row: 1, col: 1 + (i - 16) };
  return { row: 1 + (i - 24), col: 9 };
}

function isCornerTile(id) {
  return id === 0 || id === 8 || id === 16 || id === 24;
}

const TYPE_ICON = {
  start:         "▶",
  tax:           "💰",
  surprise:      "?",
  treasure:      "📬",
  transit:       "🚂",
  utility:       "💡",
  rest:          "🅿",
  holding:       "⛓",
  go_to_holding: "👮",
};

function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const rand = seededRand(42);
let _t = 0;
const TILE_DELAYS = Array.from({ length: 32 }, () => {
  const isGap = rand() < 0.3;
  _t += isGap ? 0.10 + rand() * 0.08 : 0.03 + rand() * 0.04;
  return _t;
});
const TILE_DURS = Array.from({ length: 32 }, () => 0.45 + rand() * 0.15);

export default function Board({ board, ownership, players, pendingAction }) {
  return (
    <div className="board">
      {board.map((tile) => {
        const pos      = getGridPos(tile.id);
        const isCorner = isCornerTile(tile.id);
        const owned    = ownership[tile.id];
        const ownerColor = owned ? players.find((p) => p.id === owned.ownerId)?.color : null;
        const occupants  = players.filter((p) => p.position === tile.id && !p.bankrupt);
        const isPending  = pendingAction?.tileId === tile.id;

        // Strip only for property tiles (has a group color)
        const stripColor = tile.group ? `var(--g-${tile.group})` : null;

        // Rotation: side columns face inward; top row is upside-down (classic Monopoly)
        const isLeftCol  = !isCorner && pos.col === 1;
        const isRightCol = !isCorner && pos.col === 9;
        const isTopRow   = !isCorner && pos.row === 1;
        const rotateClass = isLeftCol  ? "tile-rotate-cw"
                          : isRightCol ? "tile-rotate-ccw"
                          : isTopRow   ? "tile-rotate-180"
                          : "";

        return (
          <div
            key={tile.id}
            className={[
              "tile",
              `tile-${tile.type}`,
              "tile-enter",
              isCorner ? "tile-corner" : "",
              isPending ? "tile-pending" : "",
              rotateClass,
            ].filter(Boolean).join(" ")}
            style={{
              gridRow:           pos.row,
              gridColumn:        pos.col,
              animationDelay:    `${TILE_DELAYS[tile.id]}s`,
              animationDuration: `${TILE_DURS[tile.id]}s`,
            }}
          >
            <div className="tile-content">
              {/* Thick colored strip — only for properties, always at the inner edge */}
              {stripColor && (
                <div className="tile-strip" style={{ background: stripColor }} />
              )}

              <div className={`tile-body ${isCorner ? "tile-body-corner" : ""}`}>
                {isCorner ? (
                  <>
                    <div className="tile-icon-lg">{TYPE_ICON[tile.type]}</div>
                    <div className="tile-name">{tile.name}</div>
                  </>
                ) : (
                  <>
                    {/* Non-property tiles show a large icon */}
                    {tile.type !== "property" && TYPE_ICON[tile.type] && (
                      <div className="tile-icon">{TYPE_ICON[tile.type]}</div>
                    )}
                    <div className="tile-name">{tile.name}</div>
                    {"price" in tile && (
                      <div className="tile-price">
                        {tile.type === "tax"
                          ? `Pay $${tile.amount ?? tile.price}`
                          : `$${tile.price}`}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Ownership badge — pinned to physical tile, not rotated */}
            {owned && (
              <div
                className={`tile-owner ${owned.mortgaged ? "tile-owner-mortgaged" : ""}`}
                style={{ background: ownerColor }}
              >
                {owned.mortgaged
                  ? "M"
                  : owned.houses > 0
                    ? <span>{owned.houses === 5 ? "🏨" : owned.houses}</span>
                    : null}
              </div>
            )}

            {/* Player tokens — pinned to physical tile, not rotated */}
            <div className="tile-tokens">
              {occupants.map((p) => (
                <span key={p.id} className="token" style={{ background: p.color }} title={p.name} />
              ))}
            </div>
          </div>
        );
      })}

      <div className="board-center">
        <span>Fortune</span>
        <span>City</span>
      </div>
    </div>
  );
}
