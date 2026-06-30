import { tileGridPos, tileSide, isCorner, BOARD_GRID_TEMPLATE, BOARD_SIZE_STYLE } from "../../tileUtils.js";
import "./classicVintage.css";

// 9 group colors — classic Monopoly-style saturated band colors on ivory/cream background
const GROUP_COLORS = {
  pink:         "#e91e8c",
  blueTop:      "#74bde0",
  olive:        "#8b6914",
  salmonRight:  "#e05c3a",
  goldenrod:    "#f0a500",
  greenBottom:  "#1e7d3a",
  violetBottom: "#7b3fa0",
  salmonLeft:   "#c0392b",
  tealLeft:     "#17818a",
};

export default function ClassicVintageBoard({ board, ownership, players, pendingAction, lastRoll, rollSeq }) {
  return (
    <div className="cv2-root">
      <div
        className="cv2-board"
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
              className={`cv2-tile cv2-side-${side} ${corner ? "cv2-corner" : ""} ${isPending ? "cv2-pending" : ""}`}
              style={{ gridRow: row, gridColumn: col }}
            >
              {/* Color band on the OUTER edge (top for "top" tiles, right for "right" tiles, bottom for "bottom", left for "left") */}
              {tile.group && (
                <div className="cv2-band" style={{ background: GROUP_COLORS[tile.group] }} />
              )}
              {/* Ownership bar on INNER edge opposite the band — show if owned */}
              {owned && (
                <div className="cv2-owner-bar" style={{ background: ownerPlayer?.color || "#999" }} />
              )}
              {/* TILE BODY — name is the hero, price secondary */}
              <div className="cv2-body">
                <span className="cv2-name">{tile.name}</span>
                {tile.price != null && <span className="cv2-price">${tile.price}</span>}
                {tile.amount != null && <span className="cv2-price">${tile.amount}</span>}
              </div>
              {/* Development level */}
              {owned && (owned.houses > 0 || owned.mortgaged) && (
                <div className="cv2-dev">
                  {owned.mortgaged ? "M" : owned.houses === 5 ? "H" : owned.houses}
                </div>
              )}
              {/* Player tokens */}
              {tokensHere.length > 0 && (
                <div className="cv2-tokens">
                  {tokensHere.map(p => (
                    <span key={p.id} className="cv2-token" style={{ background: p.color }}>
                      {p.name?.[0]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {/* Board center */}
        <div className="cv2-center">
          <div className="cv2-title">Monoboly عرب</div>
          {lastRoll && (
            <div className="cv2-dice">
              {lastRoll[0]} + {lastRoll[1]}
            </div>
          )}
          <div className="cv2-players">
            {players.map(p => (
              <div key={p.id} className="cv2-player-row">
                <span className="cv2-dot" style={{ background: p.color }} />
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
