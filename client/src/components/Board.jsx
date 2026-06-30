import { TILE_ICON } from "./icons";
import Dice from "./Dice";

const BIG_ICON_TYPES = ["start", "holding", "go_to_holding"];

// 48 tiles, 12 per side, on a 13x13 grid. Ids increase clockwise from
// Start (top-left): rightward across the top, down the right side,
// leftward across the bottom, up the left side back to Start.
function getGridPos(i) {
  if (i <= 12) return { row: 1, col: 1 + i };
  if (i <= 24) return { row: 1 + (i - 12), col: 13 };
  if (i <= 36) return { row: 13, col: 13 - (i - 24) };
  return { row: 13 - (i - 36), col: 1 };
}

export default function Board({ board, ownership, players, pendingAction, lastRoll, rollSeq }) {
  return (
    <div className="board">
      {board.map((tile) => {
        const pos = getGridPos(tile.id);
        const owned = ownership[tile.id];
        const ownerColor = owned ? players.find((p) => p.id === owned.ownerId)?.color : null;
        const occupants = players.filter((p) => p.position === tile.id && !p.bankrupt);
        const isPending = pendingAction?.tileId === tile.id;
        const Icon = TILE_ICON[tile.type];
        const isBigIcon = BIG_ICON_TYPES.includes(tile.type);
        const priceValue = tile.price ?? tile.amount;
        return (
          <div
            key={tile.id}
            className={`tile tile-${tile.type} ${isPending ? "tile-pending" : ""}`}
            style={{ gridRow: pos.row, gridColumn: pos.col }}
          >
            {tile.group && <div className="tile-band" style={{ background: `var(--g-${tile.group})` }} />}
            <div className="tile-body">
              {Icon && isBigIcon && (
                <div className="tile-icon tile-icon-lg">
                  <Icon />
                </div>
              )}
              {Icon && !isBigIcon && (
                <div className="tile-icon-badge">
                  <Icon />
                </div>
              )}
              <div className="tile-name">{tile.name}</div>
              {priceValue !== undefined && <div className="tile-price-badge">${priceValue}</div>}
            </div>
            {owned && <div className="tile-owner-strip" style={{ background: ownerColor }} />}
            {owned && (owned.mortgaged || owned.houses > 0) && (
              <div className={`tile-dev-badge ${owned.mortgaged ? "tile-dev-badge-mortgaged" : ""}`}>
                {owned.mortgaged ? "M" : owned.houses === 5 ? "H" : owned.houses}
              </div>
            )}
            {occupants.length > 0 && (
              <div className="tile-tokens">
                {occupants.map((p) => (
                  <span key={p.id} className="token" style={{ background: p.color }} title={p.name}>
                    {p.name?.[0]}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="board-center">
        <h2>Monoboly عرب</h2>
        <Dice roll={lastRoll} rollSeq={rollSeq} />
        {lastRoll && (
          <p className="board-center-dice">
            {lastRoll[0]} + {lastRoll[1]} = {lastRoll[0] + lastRoll[1]}
          </p>
        )}
      </div>
    </div>
  );
}
