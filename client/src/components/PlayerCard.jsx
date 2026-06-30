import { useState } from "react";
import { socket } from "../socket";
import { CHARACTERS } from "../data/characters";

export default function PlayerCard({ player, isMyTurn, pendingAction }) {
  const [flipped, setFlipped] = useState(false);
  if (!player) return null;
  const char = CHARACTERS.find((c) => c.id === player.characterId);
  if (!char) return null;
  const imgSrc = player.balance >= 3000 ? char.v2 : char.v1;
  const cooldowns = player.abilityCooldowns || {};

  function activate(e, abilityId) {
    e.stopPropagation();
    socket.emit("useAbility", { abilityId });
  }

  return (
    <div
      className={`player-card ${flipped ? "flipped" : ""}`}
      onClick={() => setFlipped((f) => !f)}
      title={flipped ? "Click to flip back" : "Click to read abilities"}
    >
      <div className="player-card-inner">
        <div className="player-card-front">
          <div className="player-card-portrait">
            <img src={imgSrc} alt={char.name} />
          </div>
          <div className="player-card-label">
            <span className="player-card-name">{char.name}</span>
            <span className="player-card-desc">{char.description}</span>
          </div>
          <div className="player-card-tracker">
            {char.actives?.map((ability) => {
              const remaining = cooldowns[ability.id] || 0;
              const ready = remaining === 0;
              const disabled = !ready || !isMyTurn || !!pendingAction;
              return (
                <div className="ability-tracker-row" key={ability.id}>
                  <span className="ability-tracker-label">{ability.label}</span>
                  <span className={`ability-tracker-status ${ready ? "ability-ready" : "ability-charging"}`}>
                    {ready ? "جاهزة" : `${remaining} جولات`}
                  </span>
                  <button
                    className="ability-activate-btn"
                    disabled={disabled}
                    onClick={(e) => activate(e, ability.id)}
                    title={!isMyTurn ? "ليس دورك الآن" : !ready ? "ما زالت تُشحن" : "استخدم القدرة"}
                  >
                    تفعيل
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="player-card-back">
          <div className="player-card-back-name">{char.name}</div>
          <div className="player-card-abilities">
            {char.passive && (
              <div className="char-ability">
                <span className="char-ability-tag">سلبية</span>
                <p>{char.passive}</p>
              </div>
            )}
            {char.actives?.map((ability) => (
              <div className="char-ability" key={ability.id}>
                <span className="char-ability-tag char-ability-tag-active">
                  فعّالة — {ability.label} ({ability.cooldownTurns} جولات)
                </span>
                <p>{ability.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
