const TARGET_HINTS = {
  tile: "Click a tile on the board…",
  player: "Click a player in the list…",
  copyFrom: "Click a player to copy their ability…",
};

// Sits above MyProperties in the left panel -- shows the viewed player's
// character, their ability's description/cooldown, and an Activate button.
// For a "none" targetType (Wrecking Tour) Activate fires immediately; for
// "tile"/"player" it hands off to App.jsx's shared targeting state machine,
// which is what actually submits once a tile/player is clicked elsewhere.
export default function CharacterPanel({ state, myId, onUseAbility, targeting, abilityError, onStartTargeting, onCancelTargeting, tokenMoving }) {
  const me = state.players.find((p) => p.id === myId);

  if (!me?.character) return null;

  const info = state.characters?.[me.character];
  const ability = state.abilities?.[me.character];
  const ready = me.abilityCooldown <= 0;
  // tokenMoving also covers a still-playing ability animation, not just a
  // token glide (see BoardClassic's abilityAnimating) -- blocked here too so
  // a second ability can't be cast mid-sequence and race the first one's own
  // timers over shared visual state (e.g. boardShaking), on top of a move
  // already blocking it the same way. Kept separate from `ready` (cooldown
  // only) so the header still reads "✓ Ready" instead of falsely claiming
  // turns are still left on cooldown while a move/animation is just
  // temporarily blocking the button.
  const canActivate = ready && !tokenMoving;
  const isTargeting = !!targeting;

  function handleActivateClick() {
    if (ability?.targetType === "none") {
      onUseAbility({}, () => {});
    } else {
      onStartTargeting(ability?.targetType);
    }
  }

  // Copy Cat's step 2 (targeting.copyFromId is set) picks the COPIED
  // ability's own target, not Copy Cat's -- name it in the hint so it's
  // clear what's actually about to happen.
  function targetingHint() {
    if (!targeting) return "";
    const baseHint = TARGET_HINTS[targeting.targetType] || "Pick a target…";
    if (!targeting.copyFromId) return baseHint;
    const copiedCharacterId = state.players.find((p) => p.id === targeting.copyFromId)?.character;
    const copiedAbility = copiedCharacterId ? state.abilities?.[copiedCharacterId] : null;
    return `Copying ${copiedAbility?.activeName || "their ability"} -- ${baseHint}`;
  }

  return (
    <div className="character-panel">
      <div className="character-panel-header">
        <span className="character-panel-name">{info?.name || me.character}</span>
        <span className={`character-panel-cooldown${ready ? " ready" : ""}`}>
          {ready ? "✓ Ready" : `⏳ ${me.abilityCooldown} turn${me.abilityCooldown === 1 ? "" : "s"} left`}
        </span>
      </div>

      {ability && (
        <div className="character-panel-body">
          <p className="character-panel-passive"><strong>Passive:</strong> {ability.passiveDescription}</p>
          <p className="character-panel-active-desc"><strong>{ability.activeName}:</strong> {ability.description}</p>
        </div>
      )}

      {me.bankrupt ? (
        <p className="character-panel-error">Bankrupt -- spectating, no more abilities to use.</p>
      ) : isTargeting ? (
        <div className="character-panel-targeting">
          <p className="character-panel-targeting-hint">{targetingHint()}</p>
          <button className="character-panel-cancel" onClick={onCancelTargeting}>Cancel</button>
        </div>
      ) : (
        <button className="character-panel-activate" disabled={!canActivate} onClick={handleActivateClick}>
          Activate Ability
        </button>
      )}

      {abilityError && <p className="character-panel-error">{abilityError}</p>}
    </div>
  );
}
