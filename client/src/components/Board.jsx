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
  start:         "🏠",
  tax:           "💸",
  surprise:      "❓",
  treasure:      "🎁",
  transit:       "🚇",
  utility:       "⚡",
  rest:          "🌳",
  holding:       "🔒",
  go_to_holding: "👮",
};

// Glow color for non-group tiles
const TYPE_GLOW = {
  surprise:      "#ec4899",
  treasure:      "#f4c542",
  tax:           "#f97316",
  transit:       "#3b82f6",
  utility:       "#facc15",
  rest:          "#10b981",
  holding:       "#94a3b8",
  go_to_holding: "#ef4444",
  start:         "#10b981",
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
        const ownerColor  = owned ? players.find((p) => p.id === owned.ownerId)?.color : null;
        const occupants   = players.filter((p) => p.position === tile.id && !p.bankrupt);
        const isPending   = pendingAction?.tileId === tile.id;
        const glowColor   = tile.group ? `var(--g-${tile.group})` : (TYPE_GLOW[tile.type] ?? "transparent");
        const stripColor  = tile.group ? `var(--g-${tile.group})` : (TYPE_GLOW[tile.type] ?? null);

        return (
          <div
            key={tile.id}
            className={`tile tile-${tile.type} tile-enter ${isCorner ? "tile-corner" : ""} ${isPending ? "tile-pending" : ""}`}
            style={{
              gridRow:           pos.row,
              gridColumn:        pos.col,
              animationDelay:    `${TILE_DELAYS[tile.id]}s`,
              animationDuration: `${TILE_DURS[tile.id]}s`,
            }}
          >
            {/* Glow blob behind content */}
            <div className="tile-glow" style={{ background: glowColor }} />

            {/* Thin color strip at top */}
            {stripColor && (
              <div className="tile-strip" style={{ background: stripColor }} />
            )}

            {/* Main content */}
            <div className={`tile-body ${isCorner ? "tile-body-corner" : ""}`}>
              {isCorner ? (
                <>
                  <div className="tile-icon-lg">{TYPE_ICON[tile.type]}</div>
                  <div className="tile-name">{tile.name}</div>
                </>
              ) : (
                <>
                  {/* Group dot for properties */}
                  {tile.group && (
                    <div className="tile-dot" style={{ background: `var(--g-${tile.group})` }} />
                  )}
                  {/* Large icon for non-property tiles */}
                  {tile.type !== "property" && TYPE_ICON[tile.type] && (
                    <div className="tile-icon">{TYPE_ICON[tile.type]}</div>
                  )}
                  <div className="tile-name">{tile.name}</div>
                  {"price" in tile && (
                    <div className="tile-price" style={{ color: tile.type === "tax" ? "#f97316" : undefined }}>
                      {tile.type === "tax" ? `-$${tile.amount ?? tile.price}` : `$${tile.price}`}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Ownership badge */}
            {owned && (
              <div
                className={`tile-owner ${owned.mortgaged ? "tile-owner-mortgaged" : ""}`}
                style={{ background: ownerColor }}
              >
                {owned.mortgaged ? "M" : owned.houses > 0
                  ? <span>{owned.houses === 5 ? "🏨" : owned.houses}</span>
                  : null}
              </div>
            )}

            {/* Player tokens */}
            <div className="tile-tokens">
              {occupants.map((p) => (
                <span key={p.id} className="token" style={{ background: p.color }} title={p.name} />
              ))}
            </div>
          </div>
        );
      })}

      <div className="board-center">
        <h2>Fortune City</h2>
      </div>
    </div>
  );
}
