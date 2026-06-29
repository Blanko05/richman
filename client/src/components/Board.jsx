function getGridPos(i) {
  if (i <= 8)  return { row: 9, col: 9 - i };
  if (i <= 16) return { row: 9 - (i - 8), col: 1 };
  if (i <= 24) return { row: 1, col: 1 + (i - 16) };
  return { row: 1 + (i - 24), col: 9 };
}

function isCornerTile(id) {
  return id === 0 || id === 8 || id === 16 || id === 24;
}

/* Hex values for the inline radial glow on property tiles */
const GROUP_HEX = {
  copper:   '#a0522d',
  teal:     '#29b6e8',
  violet:   '#e91e8c',
  amber:    '#ff6d00',
  crimson:  '#f44336',
  azure:    '#fdd835',
  jade:     '#43a047',
  obsidian: '#1e88e5',
};

/* Icons for non-property edge tiles */
const SPECIAL_ICON = {
  transit:       '🚂',
  utility:       '⚡',
  tax:           '💸',
  surprise:      '❓',
  treasure:      '📦',
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

/* ─── Corner tile components ─────────────────────────── */
function CornerGo() {
  return (
    <div className="corner-wrap">
      <div className="corner-icon">🟢</div>
      <div className="corner-label">GO</div>
      <div className="corner-sub">Collect 200 $</div>
    </div>
  );
}

function CornerJail({ name }) {
  return (
    <div className="corner-wrap">
      <div className="corner-icon">🔒</div>
      <div className="corner-label">{name}</div>
      <div className="corner-sub">Just Visiting</div>
    </div>
  );
}

function CornerParking({ name }) {
  return (
    <div className="corner-wrap">
      <div className="corner-icon">🅿️</div>
      <div className="corner-label">Free</div>
      <div className="corner-sub">{name}</div>
    </div>
  );
}

function CornerGoToJail({ name }) {
  return (
    <div className="corner-wrap">
      <div className="corner-icon">💀</div>
      <div className="corner-label">Go to prison</div>
    </div>
  );
}

function CornerContent({ tile }) {
  switch (tile.type) {
    case 'start':         return <CornerGo />;
    case 'holding':       return <CornerJail      name={tile.name} />;
    case 'rest':          return <CornerParking   name={tile.name} />;
    case 'go_to_holding': return <CornerGoToJail  name={tile.name} />;
    default:
      return (
        <div className="corner-wrap">
          <div className="corner-icon">★</div>
          <div className="corner-label">{tile.name}</div>
        </div>
      );
  }
}

export default function Board({ board, ownership, players, pendingAction }) {
  return (
    <div className="board">
      {board.map((tile) => {
        const pos        = getGridPos(tile.id);
        const isCorner   = isCornerTile(tile.id);
        const owned      = ownership[tile.id];
        const ownerColor = owned ? players.find((p) => p.id === owned.ownerId)?.color : null;
        const occupants  = players.filter((p) => p.position === tile.id && !p.bankrupt);
        const isPending  = pendingAction?.tileId === tile.id;
        const isProperty = !!tile.group;

        const groupHex   = tile.group ? GROUP_HEX[tile.group] : null;
        const groupVar   = tile.group ? `var(--g-${tile.group})` : null;

        const isLeftCol  = !isCorner && pos.col === 1;
        const isRightCol = !isCorner && pos.col === 9;
        const isTopRow   = !isCorner && pos.row === 1;
        const rotateClass = isLeftCol  ? 'tile-rotate-cw'
                          : isRightCol ? 'tile-rotate-ccw'
                          : isTopRow   ? 'tile-rotate-180'
                          : '';

        return (
          <div
            key={tile.id}
            className={[
              'tile',
              `tile-${tile.type}`,
              'tile-enter',
              isCorner  ? 'tile-corner'  : '',
              isPending ? 'tile-pending' : '',
              rotateClass,
            ].filter(Boolean).join(' ')}
            style={{
              gridRow:           pos.row,
              gridColumn:        pos.col,
              animationDelay:    `${TILE_DELAYS[tile.id]}s`,
              animationDuration: `${TILE_DURS[tile.id]}s`,
            }}
          >
            <div className="tile-content">
              {isCorner ? (
                /* ── Corner ── */
                <div className="tile-body-corner">
                  <CornerContent tile={tile} />
                </div>

              ) : isProperty ? (
                /* ── Property tile: glow + badge + name + circle ── */
                <>
                  <div
                    className="tile-glow"
                    style={{ '--gc': groupHex }}
                  />
                  <div className="tile-prop-layout">
                    {'price' in tile && (
                      <div className="tile-price-badge">{tile.price} $</div>
                    )}
                    <div className="tile-name-lg">{tile.name}</div>
                    <div
                      className="tile-group-circle"
                      style={{ background: groupVar }}
                    />
                  </div>
                </>

              ) : (
                /* ── Special tile: icon + name ── */
                <div className="tile-special-layout">
                  {SPECIAL_ICON[tile.type] && (
                    <div className="tile-special-icon">
                      {tile.type === 'surprise'
                        ? <span className="tile-q-mark">?</span>
                        : SPECIAL_ICON[tile.type]}
                    </div>
                  )}
                  <div className="tile-special-name">{tile.name}</div>
                  {'price' in tile && (
                    <div className="tile-special-price">
                      {tile.type === 'tax'
                        ? `${tile.amount ?? tile.price} $`
                        : `${tile.price} $`}
                    </div>
                  )}
                </div>
              )}
            </div>

            {owned && (
              <div
                className={`tile-owner${owned.mortgaged ? ' tile-owner-mortgaged' : ''}`}
                style={{ background: ownerColor }}
              >
                {owned.mortgaged ? 'M'
                  : owned.houses > 0
                    ? <span>{owned.houses === 5 ? '🏨' : owned.houses}</span>
                    : null}
              </div>
            )}

            <div className="tile-tokens">
              {occupants.map((p) => (
                <span
                  key={p.id}
                  className="token"
                  style={{ background: p.color }}
                  title={p.name}
                />
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
