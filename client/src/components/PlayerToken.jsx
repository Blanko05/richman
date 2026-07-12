import { ICONS } from "../data/icons";

export default function PlayerToken({ player, stackIndex, stackTotal, leftPct, topPct, glideMs, glideEase, isMoving, isLanding, justBought, isActiveTurn, isBusRiding, isBusDust, isBarricadeSnap, isCursed, isCurseDraining }) {
  const wrapStyle = {
    "--c": player.color,
    "--i": stackIndex,
    "--n": stackTotal,
    "--glide-ms": `${glideMs || 220}ms`,
    "--glide-ease": glideEase || "ease",
    // Grows the whole token (not just the icon inside it) while riding the
    // bus -- reads as a bigger visual event than swapping the face alone,
    // and scaling the outer .cv2-token wrapper (rather than the inner face)
    // means the bus glyph inside grows proportionally with it for free.
    "--bus-scale": isBusRiding ? 1.4 : 1,
    left: `${leftPct}%`,
    top: `${topPct}%`,
  };
  const innerCls = [
    "cv2-token-inner",
    isActiveTurn && "cv2-token--active",
    isMoving && "cv2-token--floating",
    !isMoving && isLanding && "cv2-token--landing",
    justBought && "cv2-token--celebrate",
    isBusRiding && "cv2-token--bus-glow",
    isBarricadeSnap && "cv2-token--barricade-snap",
    isCurseDraining && "cv2-token--curse-drain",
  ].filter(Boolean).join(" ");
  const innerStyle = { "--delay": `${(stackIndex * 0.3).toFixed(2)}s` };

  const icon = player.icon ? ICONS.find((i) => i.id === player.icon) : null;

  return (
    <span className="cv2-token" style={wrapStyle} title={player.name}>
      <span className={innerCls} style={innerStyle}>
        {isBusRiding ? (
          // Wrecking Tour: swap out whatever the rider's own icon/face is
          // for the same bus glyph the station tiles use, for the duration
          // of the glide -- reverts on its own once the ride ends (see
          // BoardClassic's busRidingId).
          <span
            className="cv2-token-face cv2-token-face--icon cv2-token-face--bus"
            style={{ backgroundImage: "url(/bus.svg)" }}
          />
        ) : icon ? (
          <span
            className="cv2-token-face cv2-token-face--icon"
            style={{ backgroundImage: `url(${icon.img})` }}
          />
        ) : (
          <span className="cv2-token-face">
            <span className="cv2-token-eye cv2-token-eye--l" />
            <span className="cv2-token-eye cv2-token-eye--r" />
            <span className="cv2-token-mouth" />
          </span>
        )}
      </span>
      {/* Wrecking Tour dust trail -- rendered AFTER cv2-token-inner (not
          before), unlike the first attempt at this: cv2-token-face is an
          OPAQUE circle filling the token's entire box (inset: 0), so with
          dust painted behind it (earlier in the DOM, same auto stacking
          level) the face swallowed nearly all of it -- tokens are only
          19-39px wide, so "behind the face" was effectively "invisible"
          regardless of how far the puffs drifted. Painting on top instead
          guarantees they're actually visible. Only true once the bus is
          actually gliding (BoardClassic's busDustId, set after the
          pre-departure pause), not during the parked revving window --
          see that effect's own comment for why. */}
      {isBusDust && Array.from({ length: 5 }, (_, i) => (
        <span key={i} className="cv2-token-dust" style={{ "--i": i }} />
      ))}
      {/* Z's Curse standing indicator -- sibling of cv2-token-inner (not
          nested inside it) so it never gets swept up in the inner
          element's own bob/floating/celebrate/barricade-snap animations,
          which all drive `transform`/`filter` on that element specifically.
          Persists for as long as this player is in room.activeCurses (see
          TokenLayer's isCursed) -- no seq/timing needed for this part,
          same reasoning as Barricade's own standing icon. */}
      {isCursed && (
        <img src="/reaper.png" className="cv2-token-cursed-badge" alt="" />
      )}
    </span>
  );
}
