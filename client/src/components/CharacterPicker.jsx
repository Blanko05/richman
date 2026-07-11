import { socket } from "../socket";

// In-room character picker -- like IconPicker, characters are exclusive: each
// active player must have a distinct one, so characters already taken by
// another player are disabled here. Unlike icons there's no static asset
// list to import (no portrait images exist yet -- characters.md: "Real
// portraits are decided separately"), so the roster/full ability text (both
// passive and active, same fields CharacterPanel.jsx shows in-game) come from
// room state (`characters`/`abilities`, both already exposed by
// Room.toState() pre-game) and each card is text-only.
export default function CharacterPicker({ players, myId, characters, abilities }) {
  const me = players.find((p) => p.id === myId);
  const takenIds = new Set(
    players.filter((p) => p.id !== myId && !p.left && p.character).map((p) => p.character)
  );

  function pick(characterId) {
    if (characterId === me?.character) return;
    if (takenIds.has(characterId)) return;
    socket.emit("selectCharacter", { characterId });
  }

  return (
    <div className="lobby-character-picker">
      {Object.values(characters || {}).map((char) => {
        const ability = abilities?.[char.id];
        const isTaken = takenIds.has(char.id);
        const isSelected = me?.character === char.id;
        return (
          <button
            key={char.id}
            className={`lobby-character-card${isSelected ? " selected" : ""}${isTaken ? " taken" : ""}`}
            onClick={() => pick(char.id)}
            disabled={isTaken}
            title={isTaken ? `${char.name} (taken)` : char.name}
          >
            <div className="lobby-character-card-head">
              <span className="lobby-character-card-name">{char.name}</span>
              {isSelected && <span className="lobby-character-card-check">✓ selected</span>}
              {ability && <span className="lobby-character-card-cooldown">⏱ {ability.cooldownLabel}</span>}
            </div>
            {ability && (
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
            )}
          </button>
        );
      })}
    </div>
  );
}
