import { tileGridPos, tileSide, isCorner, BOARD_GRID_TEMPLATE, BOARD_SIZE_STYLE } from "../../tileUtils.js";
import "./handDrawn.css";

const GROUP_COLORS = {
  pink:        "#c2705a",
  blueTop:     "#4a8fa8",
  olive:       "#7a8c40",
  salmonRight: "#d4603a",
  goldenrod:   "#c89a30",
  greenBottom: "#3d8b6e",
  violetBottom:"#7a4a8c",
  salmonLeft:  "#b85030",
  tealLeft:    "#2e7d6e",
};

export default function HandDrawnBoard({ board, ownership, players, pendingAction, lastRoll, rollSeq }) {
  return (
    <div className="tc-root">
      <div
        className="tc-board"
        style={{
          display: "grid",
          gridTemplateColumns: BOARD_GRID_TEMPLATE,
          gridTemplateRows: BOARD_GRID_TEMPLATE,
          ...BOARD_SIZE_STYLE,
        }}
      >
        {board.map(tile => {
          const { row, col } = tileGridPos(tile.id);
          const side        = tileSide(tile.id);
          const corner      = isCorner(tile.id);
          const owned       = ownership[tile.id];
          const ownerPlayer = owned ? players.find(p => p.id === owned.ownerId) : null;
          const tokensHere  = players.filter(p => p.position === tile.id && !p.bankrupt);
          const isPending   = pendingAction?.tileId === tile.id;

          return (
            <div
              key={tile.id}
              className={[
                "tc-tile",
                `tc-side-${side}`,
                corner     ? "tc-corner"  : "",
                isPending  ? "tc-pending" : "",
              ].filter(Boolean).join(" ")}
              style={{ gridRow: row, gridColumn: col }}
            >
              {tile.group && (
                <div
                  className="tc-band"
                  style={{ background: GROUP_COLORS[tile.group] }}
                />
              )}

              {owned && (
                <div
                  className="tc-owner-bar"
                  style={{ background: ownerPlayer?.color || "#aaa" }}
                />
              )}

              <div className="tc-body">
                <span className="tc-name">{tile.name}</span>
                {tile.price  != null && <span className="tc-price">{tile.price}$</span>}
                {tile.amount != null && <span className="tc-price">{tile.amount}$</span>}
              </div>

              {owned && (owned.houses > 0 || owned.mortgaged) && (
                <div className="tc-dev">
                  {owned.mortgaged
                    ? "M"
                    : owned.houses === 5
                      ? "H"
                      : owned.houses}
                </div>
              )}

              {tokensHere.length > 0 && (
                <div className="tc-tokens">
                  {tokensHere.map(p => (
                    <span
                      key={p.id}
                      className="tc-token"
                      style={{ background: p.color }}
                    >
                      {p.name?.[0]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="tc-center">
          <div className="tc-title">Monoboly عرب</div>
          {lastRoll && (
            <div className="tc-dice">{lastRoll[0]} + {lastRoll[1]}</div>
          )}
          <div className="tc-players">
            {players.map(p => (
              <div key={p.id} className="tc-prow">
                <span className="tc-dot" style={{ background: p.color }} />
                <span>{p.name}</span>
                <span>{p.balance}$</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
