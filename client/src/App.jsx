import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import { loadSession, saveSession, clearSession } from "./session";
import { getStoredTheme, applyTheme } from "./theme";
import Lobby from "./components/Lobby";
import BoardClassic from "./components/BoardClassic";
import PlayersPanel from "./components/PlayersPanel";
import MyProperties from "./components/MyProperties";
import CharacterPanel from "./components/CharacterPanel";
import OpenTrades from "./components/OpenTrades";
import GameLog from "./components/GameLog";
import TradeModal from "./components/TradeModal";
import AuctionModal from "./components/AuctionModal";
import DevTools from "./components/DevTools";
import ConfirmDialog from "./components/ConfirmDialog";
import RulesPanel from "./components/RulesPanel";
import IconPicker from "./components/IconPicker";
import CharactersWaitroom from "./components/CharactersWaitroom";
import ThemeToggle from "./components/ThemeToggle";
import { IconCopy, IconCheck } from "./components/icons";
import { ICONS } from "./data/icons";
import { playTradePopup, playTradeAccepted, playTradeDeclined, playBoughtTile, playCardPull, playWin, playGameStart, playError, playMortgage, playBuild, playSellBuilding, playDoubleDice, playThirdDouble, playGoToPrison } from "./sfx";
import "./App.css";

// Eagerly fetches every player-icon image the instant this module loads --
// well before a player ever reaches the waitroom's IconPicker -- so they're
// already decoded and cached instead of visibly popping in over the network
// the first time that picker (or a board token wearing one) renders.
ICONS.forEach((icon) => {
  const img = new Image();
  img.src = icon.img;
});

function App() {
  const [joined, setJoined] = useState(false);
  const [state, setState] = useState(null);
  const [myId, setMyId] = useState(null);
  const [rejoining, setRejoining] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [startError, setStartError] = useState("");
  const [theme, setTheme] = useState(getStoredTheme);
  const [codeCopied, setCodeCopied] = useState(false);
  // Whether the current turn's token is still gliding to its destination
  // tile -- lifted out of BoardClassic so CardReveal can hold off popping up
  // a drawn Surprise/Treasure card until the token has actually landed.
  const [tokenMoving, setTokenMoving] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  // Sandbox mode only (decisions.md): every seat's {playerId, token,
  // characterId}, so this one tab can hop between all 6 via sandboxBecome.
  // null outside sandbox mode -- also doubles as "are we in a sandbox" for
  // gating PlayersPanel's click-to-switch (never something a real multiplayer
  // room should allow).
  const [sandboxIdentities, setSandboxIdentities] = useState(null);
  // Shared ability-targeting state machine: null when no ability is mid-pick,
  // otherwise { targetType: "tile"|"player", pendingParams }. While set, a
  // board tile click (targetType "tile") or a player row click (targetType
  // "player") submits that as the ability's target instead of its normal
  // behavior (opening a property card / switching sandbox identity).
  // pendingParams carries any params already chosen in an earlier step (only
  // needed once Copy Cat's two-step targeting is wired).
  const [targeting, setTargeting] = useState(null);
  const [abilityError, setAbilityError] = useState("");

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Tracks each player's last-known position so an incoming "state" broadcast
  // that moves someone can flip tokenMoving to true in the SAME render as the
  // new position/card data (see handleState below). BoardClassic's own glide
  // effect detects the same move independently to drive the visual animation
  // and flips tokenMoving back to false once the token actually lands
  // (via onTokenMovingChange) -- this ref only needs to catch the leading
  // edge early enough that CardReveal never sees the new card before
  // tokenMoving is already true, which a purely effect-driven flag (set one
  // render after the state update lands) was consistently one render late for.
  const prevMovePositionsRef = useRef(new Map());

  // Tracks game-started transitions so the start fanfare only plays once.
  const prevStartedRef = useRef(false);

  // Tracks winner transitions so the win fanfare only plays once.
  const prevWinnerRef = useRef(false);

  // Chimes for everyone in the room the instant any new trade offer shows up
  // in state.trades, not just its recipient. seenTradeIdsRef starts empty and
  // gets bulk-seeded (no sound) the first time state+myId are both
  // available, so trades that already existed before this session started
  // watching (e.g. on rejoin) don't retroactively trigger the chime -- only
  // genuinely new ones after that do.
  const seenTradeIdsRef = useRef(new Set());
  const tradesSeededRef = useRef(false);
  useEffect(() => {
    if (!state || !myId) return;
    const trades = state.trades || [];
    const seen = seenTradeIdsRef.current;
    if (!tradesSeededRef.current) {
      trades.forEach((t) => seen.add(t.id));
      tradesSeededRef.current = true;
      return;
    }
    let hasNewTrade = false;
    trades.forEach((t) => {
      if (seen.has(t.id)) return;
      seen.add(t.id);
      hasNewTrade = true;
    });
    if (hasNewTrade) playTradePopup();
  }, [state, myId]);

  // Clears a stale "every player must choose an icon" start-game error the
  // moment that stops being true (e.g. the last holdout finally picks one),
  // instead of leaving it on screen until the host clicks Start again.
  useEffect(() => {
    if (!state || !startError) return;
    if (state.players.every((p) => p.icon)) setStartError("");
  }, [state, startError]);


  // Accept/decline and buying a tile have no dedicated socket event of their
  // own that reaches every client (respondTrade/buyProperty only call back
  // the player who acted) -- the game log entry each one pushes server-side
  // is the one signal every client in the room actually receives, so that's
  // what gets watched here instead. lastLogRef seeds silently on the first
  // state a client sees (so joining mid-game doesn't replay a sound for
  // whatever happens to already be the newest entry), then compares only the
  // newest line on each update after that.
  const lastLogRef = useRef(undefined);
  useEffect(() => {
    if (!state) return;

    // Game start / win fanfares (transition-based, not log-based).
    if (state.started && !prevStartedRef.current) playGameStart();
    prevStartedRef.current = state.started;
    if (state.winnerId && !prevWinnerRef.current) playWin();
    prevWinnerRef.current = !!state.winnerId;

    // Log-line sounds.
    const newest = (state.log || [])[0];
    const prev = lastLogRef.current;
    lastLogRef.current = newest;
    if (prev === undefined || newest === undefined || newest === prev) return;
    if (newest.includes("completed a trade.")) playTradeAccepted();
    else if (newest.includes("declined") && newest.includes("trade offer")) playTradeDeclined();
    else if (newest.includes(" bought ")) playBoughtTile();
    else if (newest.includes("mortgaged")) playMortgage();
    else if (newest.includes("unmortgaged")) playMortgage();
    else if (newest.includes("built")) playBuild();
    else if (newest.includes("sold")) playSellBuilding();
    else if (newest.includes("drew a") || newest.includes("draws a")) playCardPull();
    else if (newest.includes("went to") && newest.includes("Holding Pen")) playGoToPrison();
    else if (newest.includes("rolled doubles")) playDoubleDice();
    else if (newest.includes("three doubles")) playThirdDouble();
    else if (newest.includes("not enough")) playError();
  }, [state]);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

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

  useEffect(() => {
    function attemptRejoin() {
      const session = loadSession();
      if (!session) return;
      setRejoining(true);
      socket.emit("rejoinRoom", session, (res) => {
        setRejoining(false);
        if (res?.error) {
          clearSession();
          return;
        }
        setMyId(res.playerId);
        setJoined(true);
      });
    }

    function handleConnect() {
      attemptRejoin();
    }
    function handleDisconnect() {}
    function handleState(s) {
      const prevPositions = prevMovePositionsRef.current;
      let moved = false;
      (s.players || []).forEach((p) => {
        const prev = prevPositions.get(p.id);
        if (prev !== undefined && prev !== p.position) moved = true;
        prevPositions.set(p.id, p.position);
      });
      if (moved) setTokenMoving(true);
      // Clock-skew correction (see Room.toState's serverNow comment) -- every
      // countdown component that compares a server-issued absolute deadline
      // against its own local Date.now() reads this off state.clockOffsetMs
      // instead, so a client whose system clock disagrees with the server's
      // still counts down accurately.
      setState({ ...s, clockOffsetMs: s.serverNow ? s.serverNow - Date.now() : 0 });
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("state", handleState);

    if (socket.connected) attemptRejoin();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("state", handleState);
    };
  }, []);

  function handleJoined(res) {
    saveSession(res);
    setMyId(res.playerId);
    setJoined(true);
  }

  // Sandbox rooms are deliberately NOT persisted via saveSession -- there's
  // no single "which of the 6 identities is really me" to restore on refresh,
  // so a refresh just drops back to the lobby (session.js's single-slot
  // localStorage model has no room for 6 identities at once anyway).
  function handleSandboxJoined(res) {
    setSandboxIdentities(res.identities);
    setMyId(res.identities[0].playerId);
    setJoined(true);
  }

  // Rebinds this tab's one socket to a different sandbox seat -- see
  // sandboxBecome server-side. Only ever called with a playerId that's
  // actually in sandboxIdentities (PlayersPanel only wires this up at all
  // when sandboxIdentities is set).
  function handleSwitchIdentity(playerId) {
    const identity = sandboxIdentities?.find((i) => i.playerId === playerId);
    if (!identity) return;
    socket.emit("sandboxBecome", { code: state.code, playerId: identity.playerId, token: identity.token }, (res) => {
      if (res?.ok) {
        setMyId(identity.playerId);
        setTargeting(null);
        setAbilityError("");
      }
    });
  }

  function handleUseAbility(params, cb) {
    socket.emit("useAbility", params, cb);
  }

  // Entered from CharacterPanel's Activate button for any ability whose
  // targetType isn't "none". Copy Cat's targetType is "copyFrom", a distinct
  // value from plain "player" (Curse) -- see handlePlayerTarget below for
  // where the two-step flow actually branches.
  function startTargeting(targetType) {
    setAbilityError("");
    setTargeting({ targetType });
  }

  function cancelTargeting() {
    setTargeting(null);
  }

  // The actual submission, called either directly (targetType "none") or
  // from a board tile click / player row click while targeting is active.
  function submitAbility(params) {
    socket.emit("useAbility", params, (res) => {
      setAbilityError(res?.error || "");
    });
    setTargeting(null);
  }

  // A tile click while targeting is active. If copyFromId is set, this is
  // Copy Cat's step 2 (the copied ability's own tile target, e.g. copying
  // Detonate/Barricade/Hostile Takeover) -- otherwise it's a direct tile
  // ability (Detonate/Barricade/Hostile Takeover cast normally).
  function handleTileTarget(tileId) {
    if (!targeting) return;
    if (targeting.copyFromId) {
      submitAbility({ copyFromId: targeting.copyFromId, params: { tileId } });
    } else {
      submitAbility({ tileId });
    }
  }

  // A player-row click while targeting is active. Three cases:
  //  - targetType "copyFrom" (Copy Cat step 1): this click is WHO to copy.
  //    Look up their character's ability targetType to decide what happens
  //    next -- "none" (Wrecking Tour) submits right away, otherwise this
  //    becomes a step-2 targeting round of that type, with copyFromId
  //    stashed so the eventual submission nests correctly.
  //  - copyFromId already set (Copy Cat step 2, and the copied ability is
  //    itself player-targeted, e.g. copying Curse): this click is that
  //    ability's own target.
  //  - otherwise: a direct player-targeted ability (Curse cast normally).
  function handlePlayerTarget(playerId) {
    if (!targeting) return;
    if (targeting.targetType === "copyFrom") {
      const targetCharacterId = state.players.find((p) => p.id === playerId)?.character;
      const targetAbility = targetCharacterId ? state.abilities?.[targetCharacterId] : null;
      if (!targetAbility || targetAbility.targetType === "none") {
        submitAbility({ copyFromId: playerId, params: {} });
      } else {
        setTargeting({ targetType: targetAbility.targetType, copyFromId: playerId });
      }
      return;
    }
    if (targeting.copyFromId) {
      submitAbility({ copyFromId: targeting.copyFromId, params: { targetId: playerId } });
    } else {
      submitAbility({ targetId: playerId });
    }
  }

  function handleLeave() {
    socket.emit("leaveRoom");
    clearSession();
    setJoined(false);
    setState(null);
    setMyId(null);
    setSandboxIdentities(null);
    setTargeting(null);
    setAbilityError("");
  }

  // Voluntary forfeit -- unlike handleLeave, this does NOT clear the local
  // session/reset to the lobby: a bankrupt player stays a real (non-`left`)
  // seat server-side (Room.voluntaryBankrupt) specifically so they can keep
  // watching the rest of the game play out, not get bounced out of the room.
  function handleBankrupt() {
    socket.emit("voluntaryBankrupt");
  }

  if (rejoining) {
    return (
      <div className="lobby">
        <div className="lobby-content">
          <div className="lobby-title-float">
            <h1 className="lobby-game-title">Monoboly عرب</h1>
          </div>
          <div className="lobby-form-card visible">
            <p style={{ margin: 0, textAlign: "center", color: "var(--text-dim)", fontStyle: "italic", fontSize: 13 }}>Reconnecting…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!joined || !state) {
    return <Lobby onJoined={handleJoined} onSandboxJoined={handleSandboxJoined} theme={theme} onToggleTheme={toggleTheme} />;
  }

  // Characters mode gets its own waitroom, entirely separate from Normal
  // mode's inline one right below -- Normal mode's flow/UI must never be
  // touched for this feature.
  if (!state.started && state.mode === "characters") {
    return (
      <CharactersWaitroom
        state={state}
        myId={myId}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLeave={handleLeave}
      />
    );
  }

  if (!state.started) {
    const isHost = state.hostId === myId;
    const me = state.players.find((p) => p.id === myId);
    const rules = state.rules || {};
    return (
      <div className="lobby">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
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
            <p className="lobby-subtitle">A property-trading board game for friends, online.</p>
            <div className="lobby-ornament">
              <span className="lobby-ornament-line" />
              <span className="lobby-ornament-diamond">◆</span>
              <span className="lobby-ornament-line" />
            </div>
          </div>

          <div className="lobby-form-card waitroom-card visible">
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
                  {!p.icon && <span className="error">No icon yet</span>}
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

            {confirmingLeave && (
              <ConfirmDialog
                title="Leave room?"
                message="You'll need the room code again to rejoin."
                confirmLabel="Leave"
                cancelLabel="Stay"
                onCancel={() => setConfirmingLeave(false)}
                onConfirm={() => { setConfirmingLeave(false); handleLeave(); }}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="game-screen">
      <div className="game-screen-left">
        <CharacterPanel
          state={state}
          myId={myId}
          onUseAbility={handleUseAbility}
          targeting={targeting}
          abilityError={abilityError}
          onStartTargeting={startTargeting}
          onCancelTargeting={cancelTargeting}
          tokenMoving={tokenMoving}
        />
        <MyProperties state={state} myId={myId} />
      </div>

      <BoardClassic
        state={state}
        myId={myId}
        tokenMoving={tokenMoving}
        onTokenMovingChange={setTokenMoving}
        tileTargeting={targeting?.targetType === "tile"}
        onTileTarget={handleTileTarget}
      />

      <div className="game-screen-right">
        <PlayersPanel
          state={state}
          myId={myId}
          onLeave={handleLeave}
          onBankrupt={handleBankrupt}
          theme={theme}
          onToggleTheme={toggleTheme}
          tokenMoving={tokenMoving}
          onSwitchIdentity={sandboxIdentities ? handleSwitchIdentity : undefined}
          playerTargeting={targeting?.targetType === "player" || targeting?.targetType === "copyFrom"}
          onPlayerTarget={handlePlayerTarget}
        />
        <OpenTrades
          state={state}
          myId={myId}
          onOpen={(tradeId) => setTradeOpen({ type: "view", tradeId })}
          onCreate={() => setTradeOpen({ type: "create" })}
        />
        <GameLog state={state} />
      </div>

      {tradeOpen && state.started && (
        <TradeModal state={state} myId={myId} initialScreen={tradeOpen} onClose={() => setTradeOpen(false)} />
      )}
      <AuctionModal state={state} myId={myId} />
      {import.meta.env.DEV && <DevTools />}
    </div>
  );
}

export default App;
