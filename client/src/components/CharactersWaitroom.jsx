import { useState } from "react";
import { socket } from "../socket";
import IconPicker from "./IconPicker";
import CharacterPicker from "./CharacterPicker";
import RulesPanel from "./RulesPanel";
import ThemeToggle from "./ThemeToggle";
import ConfirmDialog from "./ConfirmDialog";
import { IconCopy, IconCheck } from "./icons";

// Pre-game waitroom for a real characters-mode room -- structurally
// independent from App.jsx's Normal-mode waitroom (which stays untouched) so
// this mode can evolve on its own. Mirrors Normal's waitroom UX (room code
// hero, player slots, icon picker, rules, start/leave) but adds the
// character picker on top, and every player must have BOTH an icon and a
// character before the host can start (Room.js's playerStartGame, gated on
// this room's mode === "characters").
export default function CharactersWaitroom({ state, myId, theme, onToggleTheme, onLeave }) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [startError, setStartError] = useState("");
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  const isHost = state.hostId === myId;
  const me = state.players.find((p) => p.id === myId);
  const rules = state.rules || {};

  async function copyRoomCode() {
    const code = state.code;
    try {
      // navigator.clipboard is only defined in secure contexts (https, or
      // localhost) -- testing over a plain-http LAN IP (common when trying
      // multiplayer from another device) leaves it undefined, and calling
      // .writeText on it throws synchronously rather than rejecting, which
      // silently broke the button with no fallback and no visible error.
      if (!navigator.clipboard || !window.isSecureContext) throw new Error("clipboard API unavailable");
      await navigator.clipboard.writeText(code);
    } catch {
      // Legacy fallback: select the code in an offscreen textarea and use
      // the old execCommand copy path, which works without the secure-
      // context restriction.
      const textarea = document.createElement("textarea");
      textarea.value = code;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try { document.execCommand("copy"); } catch { /* nothing more we can do */ }
      document.body.removeChild(textarea);
    }
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1500);
  }

  return (
    <div className="lobby">
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      <div className="lobby-credits">
        <span className="lobby-credits-label">Made by</span>
        <span className="lobby-credits-name">Khalid Khudari</span>
        <span className="lobby-credits-name">Mohamad Muhaisen</span>
        <span className="lobby-credits-name">Ameen Alrawabdeh</span>
      </div>

      <div className="lobby-content">
        <div className="lobby-title-float">
          <div className="lobby-ornament">
            <span className="lobby-ornament-line" />
            <span className="lobby-ornament-diamond">◆</span>
            <span className="lobby-ornament-line" />
          </div>
          <h1 className="lobby-game-title">Monoboly عرب</h1>
          <p className="lobby-subtitle">★ Characters Mode — pick a token and a character.</p>
          <div className="lobby-ornament">
            <span className="lobby-ornament-line" />
            <span className="lobby-ornament-diamond">◆</span>
            <span className="lobby-ornament-line" />
          </div>
        </div>

        <div className="lobby-form-card waitroom-card characters-waitroom-card visible">
          <div className="characters-waitroom-columns">
            {/* ── Left: room, players, icon, rules, actions ── */}
            <div className="characters-waitroom-left">
              {/* Room code hero */}
              <div className="waitroom-code-block">
                <div className="waitroom-code-label">Room Code</div>
                <div className="waitroom-code-row">
                  <div className="waitroom-code">{state.code}</div>
                  <button
                    className="waitroom-copy-btn"
                    onClick={copyRoomCode}
                    title="Copy room code"
                    aria-label="Copy room code"
                  >
                    {codeCopied ? <IconCheck /> : <IconCopy />}
                  </button>
                </div>
                <div className="waitroom-code-hint">Share this with friends</div>
              </div>

              <div className="lobby-divider"><span>Players {state.players.length} / 6</span></div>

              {/* Player slots */}
              <div className="waitroom-players">
                {state.players.map((p) => (
                  <div key={p.id} className="waitroom-player-row">
                    <span className="waitroom-player-dot" style={{ background: p.color }} />
                    <span className="waitroom-player-name">
                      {p.name}{p.id === myId ? " (you)" : ""}
                    </span>
                    {state.hostId === p.id && <span className="waitroom-host-badge">HOST</span>}
                  </div>
                ))}
                {Array.from({ length: Math.max(0, 2 - state.players.length) }).map((_, i) => (
                  <div key={`empty-${i}`} className="waitroom-player-row waitroom-player-empty">
                    <span className="waitroom-player-dot" style={{ background: "rgba(255,255,255,0.08)", border: "1px dashed rgba(201,150,10,0.25)" }} />
                    <span className="waitroom-player-name" style={{ opacity: 0.3, fontStyle: "italic" }}>Waiting…</span>
                  </div>
                ))}
              </div>

              {/* Your token icon */}
              <div className="lobby-input-group">
                <label className="lobby-input-label">Your Icon</label>
                <IconPicker players={state.players} myId={myId} />
                {!me?.icon && <div className="error">Please select a player icon</div>}
              </div>

              {/* Game rules panel */}
              <RulesPanel rules={rules} isHost={isHost} />

              {/* Status / action */}
              {isHost ? (
                <>
                  {state.players.length < 2 && (
                    <div className="waitroom-waiting-pulse">
                      <span className="waitroom-pulse-dot" />
                      Waiting for another player to join…
                    </div>
                  )}
                  {startError && <div className="error">{startError}</div>}
                  <button
                    className="lobby-btn-primary"
                    disabled={state.players.length < 2}
                    onClick={() => {
                      setStartError("");
                      socket.emit("startGame", (res) => {
                        if (res?.error) setStartError(res.error);
                      });
                    }}
                  >
                    Start Game
                  </button>
                </>
              ) : (
                <div className="waitroom-waiting-pulse">
                  <span className="waitroom-pulse-dot" />
                  Waiting for the host to start…
                </div>
              )}

              <button className="lobby-btn-secondary" onClick={() => setConfirmingLeave(true)}>
                Leave Room
              </button>
            </div>

            {/* ── Right: character picker (needs the room to read) ── */}
            <div className="characters-waitroom-right">
              <label className="lobby-input-label">Your Character</label>
              <CharacterPicker players={state.players} myId={myId} characters={state.characters} abilities={state.abilities} />
              {!me?.character && <div className="error">Please select a character</div>}
            </div>
          </div>

          {confirmingLeave && (
            <ConfirmDialog
              title="Leave room?"
              message="You'll need the room code again to rejoin."
              confirmLabel="Leave"
              cancelLabel="Stay"
              onCancel={() => setConfirmingLeave(false)}
              onConfirm={() => { setConfirmingLeave(false); onLeave(); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
