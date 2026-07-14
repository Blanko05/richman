import { useState } from "react";
import { socket } from "../socket";
import PlayerAvatar from "./PlayerAvatar";
import TradeCountdown from "./TradeCountdown";

const TIME_LIMIT_OPTIONS = [
  { label: "No limit", value: null },
  { label: "30s", value: 30 },
  { label: "1m", value: 60 },
  { label: "2m", value: 120 },
  { label: "5m", value: 300 },
];

function tradeableTiles(board, ownership, playerId) {
  return board.filter((t) => {
    const owned = ownership[t.id];
    return owned?.ownerId === playerId && !owned.houses && !owned.mortgaged;
  });
}

// Transit tiles have no color `groupColor` of their own (they're not part
// of a color group) -- falls back to the same blue used for their title-deed
// card (see TransitCardDetail/propertyCardDetail.css's --transit band).
function chipColor(tile) {
  return tile.groupColor || (tile.type === "transit" ? "#1684b7" : "#888");
}

// Reduces a trade (always stored fromId/offer.. toId/request..) down to a
// left/right layout from the perspective of whoever's looking at it. A party
// (proposer or recipient) always sees themselves on the left ("You give" /
// "You get"), same as before. A non-party spectator -- trades are now public,
// read-only for everyone in the room -- sees a neutral fromId-on-the-left
// layout instead, since there's no "you" to frame it around.
function perspectiveOf(trade, myId) {
  const isProposer = trade.fromId === myId;
  const isRecipient = trade.toId === myId;
  const isParty = isProposer || isRecipient;
  const leftIsProposer = isParty ? isProposer : true;
  return {
    isParty,
    isProposer,
    isRecipient,
    leftId: leftIsProposer ? trade.fromId : trade.toId,
    rightId: leftIsProposer ? trade.toId : trade.fromId,
    leftProperties: leftIsProposer ? trade.offerProperties : trade.requestProperties,
    leftMoney: leftIsProposer ? trade.offerMoney : trade.requestMoney,
    leftJailCard: leftIsProposer ? trade.offerJailCard : trade.requestJailCard,
    rightProperties: leftIsProposer ? trade.requestProperties : trade.offerProperties,
    rightMoney: leftIsProposer ? trade.requestMoney : trade.offerMoney,
    rightJailCard: leftIsProposer ? trade.requestJailCard : trade.offerJailCard,
  };
}

// Buckets a tradeable-tiles list into color-group sections, in first-
// occurrence board order (Map preserves insertion order, so no hardcoded
// group-order list is needed) -- lets the two-column picker read as "your
// holdings, organized like the board" instead of a flat wall of chips.
// Transit/utility tiles have no `group` field of their own, so they fall
// back to bucketing by tile type instead.
function groupTiles(tiles) {
  const groups = new Map();
  for (const tile of tiles) {
    const key = tile.group || tile.type;
    if (!groups.has(key)) groups.set(key, { color: chipColor(tile), tiles: [] });
    groups.get(key).tiles.push(tile);
  }
  return [...groups.values()];
}

// Shared grouped/2-up-grid layout for both the editable picker (PropChip)
// and the read-only view (StaticPropChip) -- renderChip is a render-prop so
// this stays agnostic to which chip variant it's laying out, keeping the
// grouping logic itself in exactly one place for both screens.
function GroupedChips({ tiles, renderChip }) {
  if (tiles.length === 0) return null;
  return (
    <div className="trade-chip-groups">
      {groupTiles(tiles).map((g, i) => (
        <div className="trade-chip-group" key={i}>
          <div className="trade-chip-group-header">
            <span className="trade-chip-group-swatch" style={{ background: g.color }} />
            <span className="trade-chip-group-count">{g.tiles.length}</span>
          </div>
          <div className="trade-chip-group-grid">{g.tiles.map(renderChip)}</div>
        </div>
      ))}
    </div>
  );
}

function PropChip({ tile, selected, onToggle }) {
  return (
    <div
      className={`trade-prop-chip${selected ? " selected" : ""}`}
      style={{ "--chip-color": chipColor(tile) }}
      onClick={() => onToggle(tile.id)}
    >
      <span className="prop-dot" />
      <span className="trade-prop-chip-name">{tile.name}</span>
      <span className="trade-prop-chip-price">${tile.price}</span>
    </div>
  );
}

// Non-interactive twin of PropChip, used by TradeView to display the fixed
// contents of an existing trade (nothing to toggle there).
function StaticPropChip({ tile }) {
  return (
    <div className="trade-prop-chip trade-prop-chip--static" style={{ "--chip-color": chipColor(tile) }}>
      <span className="prop-dot" />
      <span className="trade-prop-chip-name">{tile.name}</span>
      <span className="trade-prop-chip-price">${tile.price}</span>
    </div>
  );
}

// A player only ever holds one Get Out of Jail Free card (there's no count to
// show), so it's a single toggle-able chip alongside the property ones
// rather than a list -- reuses the same chip look via the same class names.
// Same red accent as the Wasta card's own reveal design (CardReveal) and
// the My Properties kept-card badge -- #c9960a (gold) read as just another
// property chip; this card isn't a property, so it gets the same identity
// color as everywhere else it appears.
function JailCardChip({ selected, onToggle }) {
  return (
    <div
      className={`trade-prop-chip${selected ? " selected" : ""}`}
      style={{ "--chip-color": "#c0392b" }}
      onClick={onToggle}
    >
      <span className="prop-dot" />
      <span className="trade-prop-chip-name">كرت الواسطة</span>
    </div>
  );
}

function StaticJailCardChip() {
  return (
    <div className="trade-prop-chip trade-prop-chip--static" style={{ "--chip-color": "#c0392b" }}>
      <span className="prop-dot" />
      <span className="trade-prop-chip-name">كرت الواسطة</span>
    </div>
  );
}

// Same visual as the editable coin slider, but locked to the trade's fixed
// amount -- keeps the read-only view looking like the same screen instead
// of a different summary layout.
function StaticMoneyRow({ amount }) {
  return (
    <div className="trade-money-row">
      <div className="trade-money-label">
        <span>Coins</span>
        <span className="trade-money-amount">${amount}</span>
      </div>
      <input type="range" min="0" max={Math.max(amount, 1)} value={amount} disabled />
      <div className="trade-money-range-caps">
        <span>$0</span>
        <span>${amount}</span>
      </div>
    </div>
  );
}

function TradeForm({ board, ownership, players, myId, otherId, onSubmit, submitLabel, onBack, onCancel }) {
  const [offerIds, setOfferIds] = useState([]);
  const [requestIds, setRequestIds] = useState([]);
  const [offerMoney, setOfferMoney] = useState(0);
  const [requestMoney, setRequestMoney] = useState(0);
  const [offerJailCard, setOfferJailCard] = useState(false);
  const [requestJailCard, setRequestJailCard] = useState(false);
  const [timeLimitSec, setTimeLimitSec] = useState(null);
  const [error, setError] = useState("");

  const me = players.find((p) => p.id === myId);
  const them = players.find((p) => p.id === otherId);
  const myTiles = tradeableTiles(board, ownership, myId);
  const theirTiles = tradeableTiles(board, ownership, otherId);
  const maxOffer = Math.max(0, me?.balance ?? 0);
  const maxRequest = Math.max(0, them?.balance ?? 0);

  function toggle(list, setList, id) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function submit() {
    setError("");
    onSubmit(
      {
        offerProperties: offerIds,
        offerMoney: Math.min(Number(offerMoney) || 0, maxOffer),
        offerJailCard,
        requestProperties: requestIds,
        requestMoney: Math.min(Number(requestMoney) || 0, maxRequest),
        requestJailCard,
        timeLimitSec,
      },
      (res) => {
        if (res?.error) return setError(res.error);
      }
    );
  }

  return (
    <>
      {/* Who we're trading with */}
      <div className="trade-form-header">
        <div className="trade-form-player-chip">
          <PlayerAvatar player={me} sizeClass="swatch" />
          <span className="trade-form-player-name">{me?.name} (you)</span>
          <span className="trade-form-balance-badge">${me?.balance ?? 0}</span>
        </div>
        <span className="trade-form-vs">⇄</span>
        <div className="trade-form-player-chip">
          <PlayerAvatar player={them} sizeClass="swatch" />
          <span className="trade-form-player-name">{them?.name}</span>
          <span className="trade-form-balance-badge">${them?.balance ?? 0}</span>
        </div>
        {onBack && (
          <button onClick={onBack} style={{ marginLeft: "auto", fontSize: 12, padding: "4px 10px" }}>
            ← Back
          </button>
        )}
      </div>

      {/* Two-column property picker */}
      <div className="trade-cols-2">
        <div className="trade-col-side">
          <div className="trade-col-label">You give</div>
          {(offerIds.length > 0 || offerMoney > 0 || offerJailCard) && (
            <div className="trade-col-summary">
              {offerIds.length > 0 && `${offerIds.length} propert${offerIds.length === 1 ? "y" : "ies"}`}
              {offerMoney > 0 && ` · $${offerMoney}`}
              {offerJailCard && ` · Wasta card`}
            </div>
          )}
          <div className="trade-money-row">
            <div className="trade-money-label">
              <span>Coins</span>
              <span className="trade-money-amount">${offerMoney}</span>
            </div>
            <input type="range" min="0" max={maxOffer} value={Math.min(offerMoney, maxOffer)} onChange={(e) => setOfferMoney(Number(e.target.value))} />
            <div className="trade-money-range-caps">
              <span>$0</span>
              <span>${maxOffer}</span>
            </div>
          </div>
          {myTiles.length === 0 && !me?.holdingFreeCard && (
            <p className="hint" style={{ margin: 0, fontSize: 12 }}>No tradeable properties</p>
          )}
          <GroupedChips
            tiles={myTiles}
            renderChip={(t) => (
              <PropChip key={t.id} tile={t} selected={offerIds.includes(t.id)} onToggle={(id) => toggle(offerIds, setOfferIds, id)} />
            )}
          />
          {me?.holdingFreeCard && (
            <JailCardChip selected={offerJailCard} onToggle={() => setOfferJailCard((v) => !v)} />
          )}
        </div>

        <div className="trade-col-divider" />

        <div className="trade-col-side">
          <div className="trade-col-label">You get</div>
          {(requestIds.length > 0 || requestMoney > 0 || requestJailCard) && (
            <div className="trade-col-summary">
              {requestIds.length > 0 && `${requestIds.length} propert${requestIds.length === 1 ? "y" : "ies"}`}
              {requestMoney > 0 && ` · $${requestMoney}`}
              {requestJailCard && ` · Wasta card`}
            </div>
          )}
          <div className="trade-money-row">
            <div className="trade-money-label">
              <span>Coins</span>
              <span className="trade-money-amount">${requestMoney}</span>
            </div>
            <input type="range" min="0" max={maxRequest} value={Math.min(requestMoney, maxRequest)} onChange={(e) => setRequestMoney(Number(e.target.value))} />
            <div className="trade-money-range-caps">
              <span>$0</span>
              <span>${maxRequest}</span>
            </div>
          </div>
          {theirTiles.length === 0 && !them?.holdingFreeCard && (
            <p className="hint" style={{ margin: 0, fontSize: 12 }}>No tradeable properties</p>
          )}
          <GroupedChips
            tiles={theirTiles}
            renderChip={(t) => (
              <PropChip key={t.id} tile={t} selected={requestIds.includes(t.id)} onToggle={(id) => toggle(requestIds, setRequestIds, id)} />
            )}
          />
          {them?.holdingFreeCard && (
            <JailCardChip selected={requestJailCard} onToggle={() => setRequestJailCard((v) => !v)} />
          )}
        </div>
      </div>

      <div className="trade-time-limit-row">
        <span className="trade-col-label">Time limit</span>
        <div className="trade-time-limit-options">
          {TIME_LIMIT_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              className={`trade-time-limit-btn${timeLimitSec === opt.value ? " active" : ""}`}
              onClick={() => setTimeLimitSec(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}

      <div className="trade-modal-footer">
        {onCancel && <button onClick={onCancel}>Cancel</button>}
        <button className="primary" onClick={submit}>{submitLabel}</button>
      </div>
    </>
  );
}

// Read-only view of a single open trade (incoming, outgoing, or -- trades
// are public, visible to the whole room -- someone else's entirely). The
// recipient gets Accept/Decline/Counter; the proposer (viewing their own
// pending offer) just gets Cancel; a non-party spectator gets neither, only
// a read-only look at the same screen. Counter hands off to TradeModal to
// swap this view for an editable TradeForm instead of toggling any state in
// here.
function TradeView({ trade, board, players, myId, onBack, onCounter, onClose, clockOffsetMs }) {
  const [error, setError] = useState("");
  const {
    isParty, isProposer, leftId, rightId,
    leftProperties, leftMoney, leftJailCard,
    rightProperties, rightMoney, rightJailCard,
  } = perspectiveOf(trade, myId);
  const left = players.find((p) => p.id === leftId);
  const right = players.find((p) => p.id === rightId);
  const leftTiles = leftProperties.map((id) => board[id]).filter(Boolean);
  const rightTiles = rightProperties.map((id) => board[id]).filter(Boolean);
  const leftLabel = isParty ? "You give" : `${left?.name ?? "?"} gives`;
  const rightLabel = isParty ? "You get" : `${right?.name ?? "?"} gives`;

  function respond(accept) {
    setError("");
    socket.emit("respondTrade", { tradeId: trade.id, accept }, (res) => {
      if (res?.error) return setError(res.error);
      onClose();
    });
  }

  function cancelOffer() {
    setError("");
    socket.emit("cancelTrade", { tradeId: trade.id }, (res) => {
      if (res?.error) return setError(res.error);
      onClose();
    });
  }

  return (
    <>
      <div className="trade-form-header">
        <div className="trade-form-player-chip">
          <PlayerAvatar player={left} sizeClass="swatch" />
          <span className="trade-form-player-name">{left?.name}{leftId === myId ? " (you)" : ""}</span>
          <span className="trade-form-balance-badge">${left?.balance ?? 0}</span>
        </div>
        <span className="trade-form-vs">⇄</span>
        <div className="trade-form-player-chip">
          <PlayerAvatar player={right} sizeClass="swatch" />
          <span className="trade-form-player-name">{right?.name}{rightId === myId ? " (you)" : ""}</span>
          <span className="trade-form-balance-badge">${right?.balance ?? 0}</span>
        </div>
        <button onClick={onBack} style={{ marginLeft: "auto", fontSize: 12, padding: "4px 10px" }}>
          ← Back
        </button>
      </div>

      {trade.deadline && (
        <p className="trade-deadline-banner">
          Expires in <TradeCountdown deadline={trade.deadline} clockOffsetMs={clockOffsetMs} />
        </p>
      )}

      <div className="trade-cols-2">
        <div className="trade-col-side">
          <div className="trade-col-label">{leftLabel}</div>
          {leftMoney > 0 && <StaticMoneyRow amount={leftMoney} />}
          {leftTiles.length === 0 && leftMoney === 0 && !leftJailCard && (
            <p className="hint" style={{ margin: 0, fontSize: 12 }}>Nothing</p>
          )}
          <GroupedChips tiles={leftTiles} renderChip={(t) => <StaticPropChip key={t.id} tile={t} />} />
          {leftJailCard && <StaticJailCardChip />}
        </div>

        <div className="trade-col-divider" />

        <div className="trade-col-side">
          <div className="trade-col-label">{rightLabel}</div>
          {rightMoney > 0 && <StaticMoneyRow amount={rightMoney} />}
          {rightTiles.length === 0 && rightMoney === 0 && !rightJailCard && (
            <p className="hint" style={{ margin: 0, fontSize: 12 }}>Nothing</p>
          )}
          <GroupedChips tiles={rightTiles} renderChip={(t) => <StaticPropChip key={t.id} tile={t} />} />
          {rightJailCard && <StaticJailCardChip />}
        </div>
      </div>

      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}

      <div className="trade-modal-footer">
        {!isParty ? (
          <p className="hint" style={{ margin: 0 }}>
            Only {left?.name} and {right?.name} can act on this trade.
          </p>
        ) : isProposer ? (
          <button className="primary" onClick={cancelOffer}>Cancel Trade</button>
        ) : (
          <>
            <button onClick={() => respond(false)}>Decline</button>
            <button onClick={onCounter}>Counter</button>
            <button className="primary" onClick={() => respond(true)}>Accept</button>
          </>
        )}
      </div>
    </>
  );
}

export default function TradeModal({ state, myId, onClose, initialScreen }) {
  const { board, ownership, players, trades, clockOffsetMs } = state;
  // { type: "menu" } | { type: "create" } | { type: "propose", playerId } | { type: "view", tradeId } | { type: "counter", tradeId }
  const [screen, setScreen] = useState(initialScreen || { type: "menu" });
  const others = players.filter((p) => p.id !== myId && !p.bankrupt && !p.left);
  // Trades are public -- every active player can see every open trade in the
  // room, read-only unless they're one of its two actual parties (TradeView
  // gates Accept/Decline/Counter/Cancel on that, not this list).
  const openTrades = trades;

  // A trade a screen is pointing at can vanish out from under it (accepted,
  // declined, or canceled by the other side) -- fall back to the menu
  // instead of rendering a view/counter screen with nothing to show.
  const activeTrade = (screen.type === "view" || screen.type === "counter")
    ? openTrades.find((t) => t.id === screen.tradeId)
    : null;
  const effectiveScreen = (screen.type === "view" || screen.type === "counter") && !activeTrade
    ? { type: "menu" }
    : screen;

  function proposeNew(params, ack) {
    socket.emit("proposeTrade", { toId: effectiveScreen.playerId, ...params }, (res) => {
      ack(res);
      if (res?.ok) onClose();
    });
  }

  function counterExisting(params, ack) {
    socket.emit("counterTrade", { tradeId: effectiveScreen.tradeId, ...params }, (res) => {
      ack(res);
      if (res?.ok) onClose();
    });
  }

  return (
    <div className="trade-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="trade-modal">
        <div className="trade-modal-header">
          <h2>
            {effectiveScreen.type === "menu" ? "Trade"
              : effectiveScreen.type === "create" ? "Create a Trade"
              : effectiveScreen.type === "view" ? "Trade Offer"
              : effectiveScreen.type === "counter" ? "Counter Offer"
              : "Propose Trade"}
          </h2>
          <button className="trade-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="trade-modal-body">
          {effectiveScreen.type === "create" && (
            <>
              <p className="trade-section-label">Select a player to trade with:</p>
              <div className="trade-player-list">
                {others.map((p) => (
                  <button
                    key={p.id}
                    className="trade-player-btn trade-player-btn--create"
                    onClick={() => setScreen({ type: "propose", playerId: p.id })}
                  >
                    <PlayerAvatar player={p} sizeClass="trade-player-avatar-lg" />
                    <span className="trade-player-btn-name">{p.name}</span>
                  </button>
                ))}
                {others.length === 0 && (
                  <p className="hint" style={{ margin: 0 }}>No other active players to trade with.</p>
                )}
              </div>
            </>
          )}

          {effectiveScreen.type === "menu" && (
            <>
              {openTrades.length > 0 && (
                <>
                  <p className="trade-section-label">Open trades:</p>
                  <div className="trade-player-list">
                    {openTrades.map((t) => {
                      const incomingTrade = t.toId === myId;
                      const outgoingTrade = t.fromId === myId;
                      const isParty = incomingTrade || outgoingTrade;
                      const fromP = players.find((p) => p.id === t.fromId);
                      const toP = players.find((p) => p.id === t.toId);
                      const other = players.find((p) => p.id === (incomingTrade ? t.fromId : t.toId));
                      const label = incomingTrade ? `Offer from ${other?.name}`
                        : outgoingTrade ? `Offer to ${other?.name}`
                        : `${fromP?.name ?? "?"} ⇄ ${toP?.name ?? "?"}`;
                      const badgeClass = incomingTrade ? "incoming" : outgoingTrade ? "outgoing" : "public";
                      const badgeText = incomingTrade ? "Incoming" : outgoingTrade ? "Pending" : "Public";
                      return (
                        <button key={t.id} className="trade-player-btn" onClick={() => setScreen({ type: "view", tradeId: t.id })}>
                          <PlayerAvatar player={isParty ? other : fromP} sizeClass="swatch" />
                          <span className="trade-player-btn-name">{label}</span>
                          {t.deadline && <TradeCountdown deadline={t.deadline} clockOffsetMs={clockOffsetMs} />}
                          <span className={`trade-direction-badge ${badgeClass}`}>{badgeText}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {others.length > 0 && (
                <>
                  <p className="trade-section-label">Select a player to trade with:</p>
                  <div className="trade-player-list">
                    {others.map((p) => (
                      <button key={p.id} className="trade-player-btn" onClick={() => setScreen({ type: "propose", playerId: p.id })}>
                        <PlayerAvatar player={p} sizeClass="swatch" />
                        <span className="trade-player-btn-name">{p.name}</span>
                        <span className="trade-player-btn-balance">
                          <span className="trade-balance-label">Balance</span>
                          <span className="trade-balance-amount">${p.balance}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {others.length === 0 && openTrades.length === 0 && (
                <p className="hint" style={{ margin: 0 }}>No other active players to trade with.</p>
              )}
            </>
          )}

          {effectiveScreen.type === "propose" && (
            <TradeForm
              board={board} ownership={ownership} players={players}
              myId={myId} otherId={effectiveScreen.playerId}
              onSubmit={proposeNew} submitLabel="Send Offer"
              onBack={() => setScreen(initialScreen?.type === "create" ? { type: "create" } : { type: "menu" })}
            />
          )}

          {effectiveScreen.type === "view" && activeTrade && (
            <TradeView
              trade={activeTrade} board={board} players={players} myId={myId}
              onBack={() => setScreen({ type: "menu" })}
              onCounter={() => setScreen({ type: "counter", tradeId: activeTrade.id })}
              onClose={onClose}
              clockOffsetMs={clockOffsetMs}
            />
          )}

          {effectiveScreen.type === "counter" && activeTrade && (
            <TradeForm
              board={board} ownership={ownership} players={players}
              myId={myId} otherId={activeTrade.fromId}
              onSubmit={counterExisting} submitLabel="Send counter-offer"
              onBack={() => setScreen({ type: "view", tradeId: activeTrade.id })}
              onCancel={() => setScreen({ type: "view", tradeId: activeTrade.id })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
