import { tileGridPos, tileSide, isCorner, BOARD_GRID_TEMPLATE, BOARD_SIZE_STYLE } from "../../tileUtils.js";
import "./neonCyberpunk.css";

const GROUP_COLORS = {
  pink:        "#c2185b",
  blueTop:     "#1565c0",
  olive:       "#558b2f",
  salmonRight: "#bf360c",
  goldenrod:   "#f57f17",
  greenBottom: "#1b5e20",
  violetBottom:"#4a148c",
  salmonLeft:  "#b71c1c",
  tealLeft:    "#004d40",
};

export default function NeonCyberpunkBoard({ board, ownership, players, pendingAction, lastRoll, rollSeq }) {
  return (
    <div className="de-root">
      <div
        className="de-board"
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
              className={[
                "de-tile",
                `de-side-${side}`,
                corner ? "de-corner" : "",
                isPending ? "de-pending" : "",
              ].join(" ")}
              style={{ gridRow: row, gridColumn: col }}
            >
              {tile.group && (
                <div className="de-band" style={{ background: GROUP_COLORS[tile.group] }} />
              )}
              {owned && (
                <div
                  className="de-owner-bar"
                  style={{ background: ownerPlayer?.color || "#555" }}
                />
              )}
              <div className="de-body">
                <span className="de-name">{tile.name}</span>
                {tile.price  != null && <span className="de-price">${tile.price}</span>}
                {tile.amount != null && <span className="de-price">${tile.amount}</span>}
              </div>
              {owned && (owned.houses > 0 || owned.mortgaged) && (
                <div className="de-dev">
                  {owned.mortgaged ? "M" : owned.houses === 5 ? "H" : owned.houses}
                </div>
              )}
              {tokensHere.length > 0 && (
                <div className="de-tokens">
                  {tokensHere.map(p => (
                    <span key={p.id} className="de-token" style={{ background: p.color }}>
                      {p.name?.[0]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Center panel */}
        <div className="de-center">
          <div className="de-title">Monoboly عرب</div>
          {lastRoll && (
            <div className="de-dice">{lastRoll[0]} · {lastRoll[1]}</div>
          )}
          <div className="de-players">
            {players.map(p => (
              <div key={p.id} className="de-prow">
                <span className="de-dot" style={{ background: p.color }} />
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
