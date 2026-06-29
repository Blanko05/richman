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
  start:         "→",
  transit:       "🚂",
  utility:       "💡",
  tax:           "⚖",
  surprise:      "?",
  treasure:      "📬",
  rest:          "🚗",
  holding:       "🔒",
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

/* ─── Corner tile renderers — one per Monopoly archetype ── */
function CornerGo({ name }) {
  return (
    <div className="corner-go-wrap">
      <div className="corner-collect">Collect $200<br />Salary As You Pass</div>
      <div className="corner-arrow">→</div>
      <div className="corner-go-label">GO</div>
    </div>
  );
}

function CornerJail({ name }) {
  return (
    <div className="corner-jail-wrap">
      <div className="corner-jail-visiting">Just<br />Visiting</div>
      <div className="corner-jail-bars">
        <div className="jail-bar" />
        <div className="jail-bar" />
        <div className="jail-bar" />
        <div className="jail-bar" />
      </div>
      <div className="corner-jail-label">{name}</div>
    </div>
  );
}

function CornerParking({ name }) {
  return (
    <div className="corner-parking-wrap">
      <div className="corner-parking-icon">🚗</div>
      <div className="corner-parking-label">Free</div>
      <div className="corner-parking-sub">{name}</div>
    </div>
  );
}

function CornerGoToJail({ name }) {
  return (
    <div className="corner-gtj-wrap">
      <div className="corner-gtj-icon">👮</div>
      <div className="corner-gtj-label">Go To</div>
      <div className="corner-gtj-jail">{name}</div>
    </div>
  );
}

function CornerContent({ tile }) {
  switch (tile.type) {
    case "start":         return <CornerGo          name={tile.name} />;
    case "holding":       return <CornerJail        name={tile.name} />;
    case "rest":          return <CornerParking     name={tile.name} />;
    case "go_to_holding": return <CornerGoToJail    name={tile.name} />;
    default:
      return (
        <>
          <div className="tile-icon-lg">{TYPE_ICON[tile.type] ?? "★"}</div>
          <div className="tile-name">{tile.name}</div>
        </>
      );
  }
}

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

        const stripColor = tile.group ? `var(--g-${tile.group})` : null;

        const isLeftCol  = !isCorner && pos.col === 1;
        const isRightCol = !isCorner && pos.col === 9;
        const isTopRow   = !isCorner && pos.row === 1;
        const rotateClass = isLeftCol  ? "tile-rotate-cw"
                          : isRightCol ? "tile-rotate-ccw"
                          : isTopRow   ? "tile-rotate-180"
                          : "";

        const isProperty = !!tile.group;
        const isChance   = tile.type === "surprise";
        const isTreasure = tile.type === "treasure";

        return (
          <div
            key={tile.id}
            className={[
              "tile",
              `tile-${tile.type}`,
              "tile-enter",
              isCorner  ? "tile-corner"  : "",
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
              {stripColor && (
                <div className="tile-strip" style={{ background: stripColor }} />
              )}

              {isCorner ? (
                <div className="tile-body tile-body-corner">
                  <CornerContent tile={tile} />
                </div>
              ) : isProperty ? (
                <div className="tile-body tile-body-property">
                  <div className="tile-name">{tile.name}</div>
                  {"price" in tile && <div className="tile-price">${tile.price}</div>}
                </div>
              ) : isChance ? (
                <div className="tile-body">
                  <div className="tile-chance-mark">?</div>
                  <div className="tile-name">{tile.name}</div>
                </div>
              ) : isTreasure ? (
                <div className="tile-body">
                  <div className="tile-chest-mark">📬</div>
                  <div className="tile-name">{tile.name}</div>
                </div>
              ) : (
                <div className="tile-body">
                  {TYPE_ICON[tile.type] && (
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
                </div>
              )}
            </div>

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

            <div className="tile-tokens">
              {occupants.map((p) => (
                <span key={p.id} className="token" style={{ background: p.color }} title={p.name} />
              ))}
            </div>
          </div>
        );
      })}

      <div className="board-center">
        <div className="board-center-logo">
          <span className="board-center-f">Fortune</span>
          <span className="board-center-c">City</span>
        </div>
      </div>
    </div>
  );
}
