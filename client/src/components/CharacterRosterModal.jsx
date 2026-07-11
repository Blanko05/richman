import PlayerAvatar from "./PlayerAvatar";

// Read-only "who's playing what" reference -- lets a player check every
// opponent's passive/active/cooldown mid-game without having to memorize the
// whole roster up front. Reuses the same card markup/copy as CharacterPicker
// (the pre-game picker), just non-interactive and grouped by player instead
// of by character.
export default function CharacterRosterModal({ state, onClose }) {
  const activePlayers = state.players.filter((p) => !p.left);

  return (
    <div className="trade-modal-overlay" onClick={onClose}>
      <div className="trade-modal roster-modal" onClick={(e) => e.stopPropagation()}>
        <div className="trade-modal-header">
          <h2>Characters</h2>
          <button className="trade-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="trade-modal-body roster-modal-body">
          {activePlayers.map((p) => {
            const info = state.characters?.[p.character];
            const ability = state.abilities?.[p.character];
            return (
              <div key={p.id} className="roster-entry">
                <div className="roster-entry-player">
                  <PlayerAvatar player={p} sizeClass="panel-player-dot" />
                  <span className="roster-entry-name">{p.name}{p.id === state.hostId ? " (host)" : ""}</span>
                </div>
                {info && ability ? (
                  <div className="lobby-character-card roster-ability-card">
                    <div className="lobby-character-card-head">
                      <span className="lobby-character-card-name">{info.name}</span>
                      <span className="lobby-character-card-cooldown">⏱ {ability.cooldownLabel}</span>
                    </div>
                    <div className="lobby-character-card-body">
                      <p className="lobby-character-card-row">
                        <span className="lobby-character-card-tag">Passive</span>
                        {ability.passiveDescription}
                      </p>
                      <p className="lobby-character-card-row">
                        <span className="lobby-character-card-tag active">{ability.activeName}</span>
                        {ability.description}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="roster-no-character">No character chosen yet</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
