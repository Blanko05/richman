import { tileGridPos, tileSide, isCorner, BOARD_GRID_TEMPLATE, BOARD_SIZE_STYLE } from "../../tileUtils.js";
import "./minimalFlat.css";

const GROUP_COLORS = {
  pink: "#f48fb1",
  blueTop: "#90caf9",
  olive: "#c5e1a5",
  salmonRight: "#ffab91",
  goldenrod: "#ffe082",
  greenBottom: "#a5d6a7",
  violetBottom: "#ce93d8",
  salmonLeft: "#ef9a9a",
  tealLeft: "#80cbc4",
};

export default function MinimalFlatBoard({ board, ownership, players, pendingAction, lastRoll, rollSeq }) {
  return (
    <div className="mf2-root">
      <div
        className="mf2-board"
        style={{
          display: "grid",
          gridTemplateColumns: BOARD_GRID_TEMPLATE,
          gridTemplateRows: BOARD_GRID_TEMPLATE,
          ...BOARD_SIZE_STYLE,
        }}
      >
        {board.map(tile => {
          const { row, col } = tileGridPos(tile.id);
          const side = tileSide(tile.id);
          const corner = isCorner(tile.id);
          const owned = ownership[tile.id];
          const ownerPlayer = owned ? players.find(p => p.id === owned.ownerId) : null;
          const tokensHere = players.filter(p => p.position === tile.id && !p.bankrupt);
          const isPending = pendingAction?.tileId === tile.id;
          return (
            <div
              key={tile.id}
              className={`mf2-tile mf2-side-${side} ${corner ? "mf2-corner" : ""} ${isPending ? "mf2-pending" : ""}`}
              style={{ gridRow: row, gridColumn: col }}
            >
              {tile.group && (
                <div className="mf2-band" style={{ background: GROUP_COLORS[tile.group] }} />
              )}
              {owned && (
                <div className="mf2-owner-bar" style={{ background: ownerPlayer?.color || "#bbb" }} />
              )}
              <div className="mf2-body">
                <span className="mf2-name">{tile.name}</span>
                {tile.price != null && <span className="mf2-price">${tile.price}</span>}
                {tile.amount != null && <span className="mf2-price">${tile.amount}</span>}
              </div>
              {owned && (owned.houses > 0 || owned.mortgaged) && (
                <div className="mf2-dev">
                  {owned.mortgaged ? "M" : owned.houses === 5 ? "H" : owned.houses}
                </div>
              )}
              {tokensHere.length > 0 && (
                <div className="mf2-tokens">
                  {tokensHere.map(p => (
                    <span key={p.id} className="mf2-token" style={{ background: p.color }}>
                      {p.name?.[0]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div className="mf2-center">
          <div className="mf2-title">Monoboly عرب</div>
          {lastRoll && (
            <div className="mf2-dice">
              {lastRoll[0]} + {lastRoll[1]}
            </div>
          )}
          <div className="mf2-players">
            {players.map(p => (
              <div key={p.id} className="mf2-prow">
                <span className="mf2-dot" style={{ background: p.color }} />
                <span>{p.name}</span>
                <span>${p.balance}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
