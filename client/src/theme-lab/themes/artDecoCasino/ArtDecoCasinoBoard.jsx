import { tileGridPos, tileSide, isCorner, BOARD_GRID_TEMPLATE, BOARD_SIZE_STYLE } from "../../tileUtils.js";
import "./artDecoCasino.css";

const GROUP_COLORS = {
  pink: "#e91e63",
  blueTop: "#1976d2",
  olive: "#689f38",
  salmonRight: "#f4511e",
  goldenrod: "#ffa000",
  greenBottom: "#388e3c",
  violetBottom: "#7b1fa2",
  salmonLeft: "#d32f2f",
  tealLeft: "#00796b",
};
const SPECIAL_BG = "#111";

export default function ArtDecoCasinoBoard({ board, ownership, players, pendingAction, lastRoll, rollSeq }) {
  return (
    <div className="bg-root">
      <div
        className="bg-board"
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
          const tileBg = tile.group ? GROUP_COLORS[tile.group] : SPECIAL_BG;
          return (
            <div
              key={tile.id}
              className={`bg-tile bg-side-${side} ${corner ? "bg-corner" : ""} ${isPending ? "bg-pending" : ""}`}
              style={{ gridRow: row, gridColumn: col, background: tileBg }}
            >
              {/* Owner bar on INNER edge */}
              {owned && (
                <div
                  className="bg-owner-bar"
                  style={{ background: ownerPlayer?.color || "#fff" }}
                />
              )}
              <div className="bg-body">
                <span className="bg-name">{tile.name}</span>
                {tile.price != null && <span className="bg-price">${tile.price}</span>}
                {tile.amount != null && <span className="bg-price">${tile.amount}</span>}
              </div>
              {owned && (owned.houses > 0 || owned.mortgaged) && (
                <div className="bg-dev">
                  {owned.mortgaged ? "M" : owned.houses === 5 ? "H" : owned.houses}
                </div>
              )}
              {tokensHere.length > 0 && (
                <div className="bg-tokens">
                  {tokensHere.map(p => (
                    <span key={p.id} className="bg-token" style={{ background: p.color }}>
                      {p.name?.[0]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div className="bg-center">
          <div className="bg-title">Monoboly عرب</div>
          {lastRoll && (
            <div className="bg-dice">
              {lastRoll[0]}·{lastRoll[1]}
            </div>
          )}
          <div className="bg-players">
            {players.map(p => (
              <div key={p.id} className="bg-prow">
                <span className="bg-dot" style={{ background: p.color }} />
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
