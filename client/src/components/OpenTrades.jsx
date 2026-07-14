import PlayerAvatar from "./PlayerAvatar";
import TradeCountdown from "./TradeCountdown";

// Right-panel "Trades" box -- groups the create-trade trigger and an
// at-a-glance list of every open trade in the room (public: incoming/outgoing
// offers of your own, plus every other pair's trades too, read-only for
// those) into one panel. Clicking a row jumps straight to that trade's own
// detail screen (accept/decline/counter/cancel for a party; read-only for
// anyone else) in the Trade modal, skipping the modal's own open-trades menu
// since the row itself already identifies the trade -- rows stay minimal
// (who <-> who), no status badge, just a countdown on the right for trades
// that actually have a time limit. A row not involving the viewer is dimmed
// (`.public`) so "yours" still reads as visually distinct from "everyone
// else's, just visible".
export default function OpenTrades({ state, myId, onOpen, onCreate }) {
  const { players, trades = [], clockOffsetMs } = state;
  if (!state.started) return null;
  const me = players.find((p) => p.id === myId);

  function playerLabel(id) {
    const p = players.find((pl) => pl.id === id);
    return `${p?.name ?? "?"}${id === myId ? " (you)" : ""}`;
  }

  return (
    <div className="open-trades-panel">
      <div className="open-trades-header">
        <span className="open-trades-title">Trades</span>
        {/* Bankrupt players can still watch every trade in the room (read-only,
            see the .public row treatment below), just can't start a new one. */}
        {!me?.bankrupt && (
          <button className="primary open-trades-create-btn" onClick={onCreate}>
            + Create
          </button>
        )}
      </div>
      {trades.length === 0 ? (
        <p className="open-trades-empty">No open trades</p>
      ) : (
        <div className="open-trades-list">
          {trades.map((t) => {
            const incoming = t.toId === myId;
            const isMine = incoming || t.fromId === myId;
            const fromP = players.find((p) => p.id === t.fromId);
            const toP = players.find((p) => p.id === t.toId);
            return (
              <button
                key={t.id}
                className={`open-trade-row${incoming ? " incoming" : ""}${!isMine ? " public" : ""}`}
                style={incoming ? { "--c": fromP?.color } : undefined}
                onClick={() => onOpen(t.id)}
              >
                <PlayerAvatar player={fromP} sizeClass="swatch" />
                <span className="open-trade-name">{playerLabel(t.fromId)}</span>
                <span className="open-trade-arrow">⇄</span>
                <PlayerAvatar player={toP} sizeClass="swatch" />
                <span className="open-trade-name">{playerLabel(t.toId)}</span>
                {t.deadline && <TradeCountdown deadline={t.deadline} clockOffsetMs={clockOffsetMs} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
